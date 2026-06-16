/**
 * Application-level encryption for IndexedDB at-rest protection (GDPR Art. 32 / F-01).
 *
 * KEY LIFECYCLE
 * ─────────────
 * 1. On login: AuthProvider calls deriveEncryptionKey(userId) → setActiveEncryptionKey(key).
 * 2. The CryptoKey is non-extractable and lives only in the WebCrypto subsystem — it is never
 *    serialised to localStorage or written to IndexedDB.
 * 3. The PBKDF2 salt IS stored in localStorage (key: DEVICE_SALT_STORAGE_KEY). Salts are not
 *    secret; their purpose is ensuring distinct keys per device for the same user account, so
 *    a compromised key on device A does not expose data on device B.
 * 4. On logout: AuthProvider calls clearActiveEncryptionKey() — the CryptoKey is GC'd from
 *    the WebCrypto subsystem and is irrecoverable without re-authentication.
 *
 * WIRE FORMAT
 * ───────────
 * encryptString returns:  ENCRYPTION_SENTINEL + Base64( IV[12 bytes] ‖ AES-GCM ciphertext )
 * decryptString expects the same format and falls back to plaintext if the sentinel is absent,
 * enabling graceful migration of records written before encryption was introduced.
 */

const DEVICE_SALT_STORAGE_KEY = 'np_dk_salt';
const PBKDF2_ITERATIONS = 100_000;
const IV_BYTE_LENGTH = 12; // 96-bit IV — AES-GCM specification recommendation

/**
 * Prefix prepended to every encrypted blob. Its presence lets decryptString distinguish a
 * ciphertext from a legacy plaintext value and lets the reading hook assert that decryption
 * has already occurred before data reaches the application layer.
 */
export const ENCRYPTION_SENTINEL = '$enc$';

// Module-level active key — in memory only, never serialised.
let activeKey: CryptoKey | null = null;

// ─── Binary helpers ───────────────────────────────────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const result = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    result[i] = binary.charCodeAt(i);
  }
  return result;
}

// ─── Device-scoped salt ───────────────────────────────────────────────────────

function getOrCreateDeviceSalt(): Uint8Array {
  const stored = localStorage.getItem(DEVICE_SALT_STORAGE_KEY);
  if (stored) return base64ToBytes(stored);
  const salt = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(DEVICE_SALT_STORAGE_KEY, bytesToBase64(salt));
  return salt;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Derives a non-extractable AES-GCM-256 CryptoKey from the authenticated user's ID via
 * PBKDF2-SHA-256 (100 000 iterations, device-scoped random salt).
 *
 * The derivation is deterministic for the same (userId, deviceSalt) pair, so the key
 * survives browser restarts and enables offline-first data to remain accessible across
 * sessions on the same device.
 */
export async function deriveEncryptionKey(userId: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(userId),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: getOrCreateDeviceSalt().buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable: the CryptoKey object cannot be read back or serialised
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypts plaintext with AES-GCM-256 using a freshly generated 96-bit random IV.
 * Returns: ENCRYPTION_SENTINEL + Base64( IV[12 bytes] ‖ ciphertext )
 */
export async function encryptString(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH));
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(IV_BYTE_LENGTH + cipherBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuffer), IV_BYTE_LENGTH);
  return ENCRYPTION_SENTINEL + bytesToBase64(combined);
}

/**
 * Decrypts a blob produced by encryptString.
 *
 * If the value does NOT start with ENCRYPTION_SENTINEL it is assumed to be a legacy
 * plaintext record written before encryption was introduced and is returned as-is.
 * This allows zero-downtime migration: existing unencrypted records remain readable
 * and are silently re-encrypted on the next write.
 *
 * @throws {DOMException} OperationError — if the ciphertext is corrupted or the key is wrong.
 */
export async function decryptString(key: CryptoKey, ciphertext: string): Promise<string> {
  if (!ciphertext.startsWith(ENCRYPTION_SENTINEL)) {
    return ciphertext;
  }
  const combined = base64ToBytes(ciphertext.slice(ENCRYPTION_SENTINEL.length));
  const iv = combined.slice(0, IV_BYTE_LENGTH);
  const data = combined.slice(IV_BYTE_LENGTH);
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data,
  );
  return new TextDecoder().decode(plaintextBuffer);
}

// ─── Key registry ─────────────────────────────────────────────────────────────

/** Registers the active encryption key. Called by AuthProvider immediately after login. */
export function setActiveEncryptionKey(key: CryptoKey): void {
  activeKey = key;
}

/** Clears the active encryption key from memory. Called by AuthProvider on logout. */
export function clearActiveEncryptionKey(): void {
  activeKey = null;
}

/** Returns the current active key, or null if the user is not authenticated. */
export function getActiveEncryptionKey(): CryptoKey | null {
  return activeKey;
}
