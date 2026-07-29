/**
 * At-rest encryption boundary for the local mirror's sensitive fields (GDPR Art. 32 / F-01).
 *
 * WHY THIS SITS IN THE SERVICE LAYER RATHER THAN INSIDE DEXIE
 * ───────────────────────────────────────────────────────────
 * AES-GCM via WebCrypto is asynchronous, and neither Dexie interception point can carry an async
 * transform:
 *  - Table hooks ('creating' / 'updating') are synchronous by contract. Dexie does NOT await a
 *    Promise returned from one, so the record reaches IndexedDB before the ciphertext exists and the
 *    cleartext is stored silently — with no error anywhere.
 *  - A DBCore middleware runs inside the already-open IndexedDB transaction. Awaiting a native
 *    (non-Dexie) promise there lets IndexedDB commit the transaction mid-flight; Table.update(),
 *    which Dexie lowers into a cursor-driven Collection.modify, fails outright with
 *    InvalidStateError. Reads have a matching hole: Collection.filter().toArray() iterates via
 *    openCursor, whose synchronous protocol a DBCore middleware cannot decrypt.
 *
 * So encryption happens at the call site instead. The rule is uniform and has no exceptions:
 * DECRYPT WHAT YOU READ, ENCRYPT WHAT YOU WRITE, and always do it OUTSIDE a db.transaction() block —
 * a transaction cannot survive an await on WebCrypto.
 *
 * WHICH FIELDS
 * ────────────
 * Only non-indexed fields are encrypted. Dexie's index engine reads stored values directly, so an
 * encrypted indexed field would break every query on it. ids, foreign keys, syncStatus and
 * lastModifiedAt stay in cleartext — which is also what lets the sync engine filter pending rows and
 * compare snapshots without decrypting anything.
 */
import { db, type LocalNote, type LocalSession } from './LocalDatabase';
import {
  encryptString,
  decryptString,
  getActiveEncryptionKey,
  ENCRYPTION_SENTINEL,
} from './cryptoService';

/**
 * A field held encrypted at rest. `blankValue` is what it falls back to when its ciphertext cannot be
 * decrypted (wrong key, truncated blob): a required string field must stay a string, an optional one
 * reads back as absent.
 */
interface EncryptedField {
  name: string;
  blankValue: string | undefined;
}

const NOTE_FIELDS: readonly EncryptedField[] = [
  { name: 'content', blankValue: '' },
  { name: 'unprocessedStrokes', blankValue: undefined },
];

// The AI clinical report is nominative patient data of the same sensitivity as the notes it is
// derived from. Generated offline-first, it can sit in the local mirror for days before reaching the
// server, so it is encrypted on the same terms as a note.
const SESSION_FIELDS: readonly EncryptedField[] = [
  { name: 'aiReport', blankValue: undefined },
];

/**
 * Returns a copy of `record` with every registered field encrypted, or `record` itself when nothing
 * needed encrypting (no allocation on the common path).
 *
 * A value already carrying the sentinel is left alone, so an accidental double-encryption is
 * impossible: re-encrypting would nest a second layer that a single decrypt on read could not undo,
 * silently destroying the field. Legacy rows written before a field became encrypted carry no
 * sentinel and are encrypted here on their next write.
 *
 * With no active key (unauthenticated) the record passes through untouched rather than failing. The
 * caller is outside an authenticated session, so this is the same exposure as before login.
 */
async function encryptRecord<T>(record: T, fields: readonly EncryptedField[]): Promise<T> {
  const key = getActiveEncryptionKey();
  if (!key) return record;

  const source = record as Record<string, unknown>;
  let encrypted: Record<string, unknown> | null = null;

  for (const field of fields) {
    const value = source[field.name];
    // typeof-guarded so a record missing the field (or holding a non-string) is left untouched.
    if (typeof value !== 'string' || value.startsWith(ENCRYPTION_SENTINEL)) continue;
    encrypted ??= { ...source };
    encrypted[field.name] = await encryptString(key, value);
  }

  return (encrypted ?? record) as T;
}

/**
 * Inverse of {@link encryptRecord}. A value without the sentinel is left as-is — that is the
 * zero-downtime path for rows written before encryption took effect.
 *
 * A field that fails to decrypt is blanked rather than thrown, and the failure is isolated to that
 * one field: a single corrupted blob must never reject the surrounding read, which would fail an
 * entire sync cycle including unrelated tables.
 */
async function decryptRecord<T>(record: T, fields: readonly EncryptedField[]): Promise<T> {
  const key = getActiveEncryptionKey();
  if (!key) return record;

  const source = record as Record<string, unknown>;
  let decrypted: Record<string, unknown> | null = null;

  for (const field of fields) {
    const value = source[field.name];
    if (typeof value !== 'string' || !value.startsWith(ENCRYPTION_SENTINEL)) continue;
    decrypted ??= { ...source };
    try {
      decrypted[field.name] = await decryptString(key, value);
    } catch (error) {
      console.error(
        `[RecordEncryption] Failed to decrypt "${field.name}" on record ${String(source['id'])} — blanking it to keep the read alive.`,
        error,
      );
      decrypted[field.name] = field.blankValue;
    }
  }

  return (decrypted ?? record) as T;
}

// ─── Public boundary ──────────────────────────────────────────────────────────

export function encryptNote(note: LocalNote): Promise<LocalNote> {
  return encryptRecord(note, NOTE_FIELDS);
}

export function decryptNote(note: LocalNote): Promise<LocalNote>;
export function decryptNote(note: LocalNote | undefined): Promise<LocalNote | undefined>;
export function decryptNote(note: LocalNote | undefined): Promise<LocalNote | undefined> {
  return note === undefined ? Promise.resolve(undefined) : decryptRecord(note, NOTE_FIELDS);
}

export function decryptNotes(notes: LocalNote[]): Promise<LocalNote[]> {
  return Promise.all(notes.map(note => decryptRecord(note, NOTE_FIELDS)));
}

export function encryptSession(session: LocalSession): Promise<LocalSession> {
  return encryptRecord(session, SESSION_FIELDS);
}

export function decryptSession(session: LocalSession): Promise<LocalSession>;
export function decryptSession(session: LocalSession | undefined): Promise<LocalSession | undefined>;
export function decryptSession(session: LocalSession | undefined): Promise<LocalSession | undefined> {
  return session === undefined ? Promise.resolve(undefined) : decryptRecord(session, SESSION_FIELDS);
}

export function decryptSessions(sessions: LocalSession[]): Promise<LocalSession[]> {
  return Promise.all(sessions.map(session => decryptRecord(session, SESSION_FIELDS)));
}

// ─── Legacy migration ─────────────────────────────────────────────────────────

/**
 * One-shot pass that encrypts rows still holding cleartext in a registered field.
 *
 * Necessary because the previous hook-based implementation never actually encrypted anything: every
 * note written before this module existed sits in IndexedDB as cleartext, and would stay that way
 * until the clinician happened to edit it. Reads tolerate those rows (no sentinel → passed through),
 * so this is about closing the existing exposure, not about correctness.
 *
 * Called fire-and-forget once the encryption key becomes active. Idempotent: a second run finds
 * every field already sentinel-prefixed and writes nothing.
 *
 * Each row is patched with ONLY its encrypted fields — never rewritten wholesale — so a sync cycle
 * running concurrently cannot have its syncStatus or lastModifiedAt reverted by this pass.
 */
export async function encryptLegacyRecordsAtRest(): Promise<void> {
  const key = getActiveEncryptionKey();
  if (!key) return;

  try {
    const [notes, sessions] = await Promise.all([db.notes.toArray(), db.sessions.toArray()]);
    let rewritten = 0;

    // The field lists below must mirror NOTE_FIELDS / SESSION_FIELDS. They are spelled out rather
    // than derived from them so each patch stays typed against its own record — an untyped patch
    // object would let a typo through to Dexie unnoticed.
    for (const note of notes) {
      const patch: Partial<Pick<LocalNote, 'content' | 'unprocessedStrokes'>> = {};
      if (isCleartext(note.content)) patch.content = await encryptString(key, note.content);
      if (isCleartext(note.unprocessedStrokes)) {
        patch.unprocessedStrokes = await encryptString(key, note.unprocessedStrokes);
      }
      if (Object.keys(patch).length === 0) continue;
      await db.notes.update(note.id, patch);
      rewritten++;
    }

    for (const session of sessions) {
      if (!isCleartext(session.aiReport)) continue;
      await db.sessions.update(session.id, { aiReport: await encryptString(key, session.aiReport) });
      rewritten++;
    }

    if (rewritten > 0) {
      console.info(`[RecordEncryption] Encrypted ${rewritten} legacy row(s) previously stored in cleartext.`);
    }
  } catch (error) {
    // Best-effort hardening pass: it must never break the login flow it is fired from.
    console.error('[RecordEncryption] Legacy encryption pass failed — will retry on the next login.', error);
  }
}

/** Narrows to a string field still held in cleartext (present, and lacking the sentinel). */
function isCleartext(value: string | undefined): value is string {
  return typeof value === 'string' && !value.startsWith(ENCRYPTION_SENTINEL);
}
