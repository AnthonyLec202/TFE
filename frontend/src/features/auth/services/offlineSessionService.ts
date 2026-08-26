/**
 * The last server-confirmed identity, kept on the device so the application can open without a
 * network round-trip.
 *
 * WHY THIS EXISTS
 * The session cookie is HttpOnly, so the only way to learn who is signed in is to ask the server —
 * and that answer is unavailable in precisely the situation this application was built for: offline,
 * mid-consultation, with every note already sitting in IndexedDB. Without a local copy of the
 * identity, reloading the page with no network locked the clinician out of data that never left the
 * device.
 *
 * WHAT THIS IS NOT
 * Not a credential, and not an authorisation decision. The HttpOnly cookie remains the only thing
 * that authenticates a request, and the API re-checks roles on every call regardless of what is
 * stored here. Tampering with this entry buys nothing beyond a local interface that renders until
 * the first request comes back rejected.
 *
 * VALIDITY
 * An entry is honoured for OFFLINE_SESSION_MAX_AGE_MS after the last time the *server* confirmed it.
 * Restoring from this copy deliberately does not refresh that stamp: otherwise a device that stayed
 * offline would renew its own session forever and the window would never close. Past the window the
 * clinician signs in again, which needs the network back — the local database is untouched and
 * waits.
 */
import type { AuthUser } from '../../../types/auth';

const STORAGE_KEY = 'kideo.auth.offlineSession';

/**
 * How long a session survives without the server reconfirming it.
 *
 * Twelve hours: the device is one clinician's personal tablet, so the threat model is a lost or
 * borrowed machine rather than a shared workstation, and the cost of being wrong in the strict
 * direction — locked out of a patient's notes mid-appointment — is worse than the cost of being
 * wrong in the lenient one. It comfortably covers a full day of consultations.
 */
export const OFFLINE_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

interface StoredOfflineSession {
  user: AuthUser;
  /** Epoch milliseconds of the last server confirmation. */
  confirmedAt: number;
}

/**
 * Records an identity the server has just confirmed — a sign-in, an enrolment, or a successful
 * session restore — and starts its validity window over.
 *
 * Never call this with an identity read back from storage: that would extend the window without the
 * server having said anything.
 */
export function rememberConfirmedSession(user: AuthUser): void {
  writeEntry({ user, confirmedAt: Date.now() });
}

/**
 * The stored identity, if one is present and still inside its window. Returns null otherwise, and
 * clears the entry when it has expired or cannot be read as a session.
 */
export function readOfflineSession(now: number = Date.now()): AuthUser | null {
  const entry = readEntry();
  if (!entry) return null;

  if (now - entry.confirmedAt > OFFLINE_SESSION_MAX_AGE_MS) {
    forgetOfflineSession();
    return null;
  }

  return entry.user;
}

/**
 * Mirrors a local change to the in-memory user onto the stored copy, leaving the validity window
 * where it was — a local edit is not a server confirmation.
 */
export function updateRememberedUser(partial: Partial<AuthUser>): void {
  const entry = readEntry();
  if (!entry) return;
  writeEntry({ user: { ...entry.user, ...partial }, confirmedAt: entry.confirmedAt });
}

export function forgetOfflineSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode, storage disabled). Nothing was written, nothing to clear.
  }
}

function writeEntry(entry: StoredOfflineSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Quota or unavailable storage. The session still works for as long as the tab lives; only the
    // ability to reopen offline is lost, which is a degradation rather than a failure.
  }
}

/** Reads and validates the stored entry, treating anything unrecognisable as absent. */
function readEntry(): StoredOfflineSession | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredSession(parsed)) {
      // Written by an earlier build, or corrupted. Drop it rather than reason about a shape we do
      // not recognise.
      forgetOfflineSession();
      return null;
    }
    return parsed;
  } catch {
    forgetOfflineSession();
    return null;
  }
}

function isStoredSession(value: unknown): value is StoredOfflineSession {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<StoredOfflineSession>;
  if (!Number.isFinite(entry.confirmedAt)) return false;

  const user = entry.user;
  if (typeof user !== 'object' || user === null) return false;
  return (
    typeof user.userId === 'string' && user.userId.length > 0 &&
    typeof user.email === 'string' &&
    Array.isArray(user.roles) &&
    user.roles.every(role => typeof role === 'string')
  );
}
