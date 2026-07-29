import { db } from '../../../core/offline/LocalDatabase';
import type { LocalNote, LocalPatientSync, LocalSession, LocalSessionAttendance, SyncStatus } from '../../../core/offline/LocalDatabase';
import {
  encryptNote,
  encryptSession,
  decryptNote,
  decryptSession,
  decryptSessions,
} from '../../../core/offline/recordEncryption';

export interface SessionEditableFields {
  title: string;
  date: string;
  time: string;
  patientIds: string[];
}

export async function createSession(session: LocalSession): Promise<void> {
  await db.sessions.put(await encryptSession(session));
}

export async function getSessionById(sessionId: string): Promise<LocalSession | undefined> {
  const session = await db.sessions.get(sessionId);
  // A tombstoned (pending_delete) session is treated as already gone.
  if (!session || session.syncStatus === 'pending_delete') return undefined;
  return decryptSession(session);
}

export async function getAllSessions(): Promise<LocalSession[]> {
  const sessions = await db.sessions.orderBy('date').reverse().toArray();
  // The general dashboard shows only ACTIVE work: exclude closed sessions (archived to the
  // patients' history) and any awaiting server-side deletion so they vanish immediately.
  // Filter before decrypting so no discarded row pays for a WebCrypto call.
  return decryptSessions(sessions.filter(s => !s.isClosed && s.syncStatus !== 'pending_delete'));
}

export async function updateSessionLocally(id: string, changes: SessionEditableFields): Promise<void> {
  const existing = await db.sessions.get(id);
  if (!existing) return;

  // Decrypt then re-encrypt rather than carrying the stored ciphertext through: the round trip keeps
  // the "decrypt what you read, encrypt what you write" rule uniform across every mutator here,
  // instead of each one having to reason about which fields it happens to touch.
  await db.sessions.put(await encryptSession({
    ...(await decryptSession(existing)),
    ...changes,
    syncStatus: nextSyncStatusAfterEdit(existing),
    lastModifiedAt: new Date().toISOString(),
  }));
}

export async function deleteSessionLocally(id: string): Promise<void> {
  const existing = await db.sessions.get(id);
  if (!existing) return;

  if (existing.syncStatus === 'pending_create') {
    // Never synced to the server — purge it (and its note) outright; nothing to delete remotely.
    await db.transaction('rw', db.sessions, db.notes, async () => {
      await db.notes.where('sessionId').equals(id).delete();
      await db.sessions.delete(id);
    });
    return;
  }

  // Tombstone: keep the row marked for deletion so the SyncEngine issues a server-side DELETE.
  await db.sessions.put(await encryptSession({
    ...(await decryptSession(existing)),
    syncStatus: 'pending_delete',
    lastModifiedAt: new Date().toISOString(),
  }));
}

export async function getSessionsForPatient(patientId: string): Promise<LocalSession[]> {
  const sessions = await db.sessions.where('patientIds').equals(patientId).toArray();
  // A patient's history holds any closed session; exclude tombstoned ones.
  return decryptSessions(sessions.filter(s => s.isClosed && s.syncStatus !== 'pending_delete'));
}

// Close a session with its per-patient attendance outcomes, archiving it to the patients' history.
export async function closeSessionLocally(id: string, attendances: LocalSessionAttendance[]): Promise<void> {
  const existing = await db.sessions.get(id);
  if (!existing) return;

  await db.sessions.put(await encryptSession({
    ...(await decryptSession(existing)),
    isClosed: true,
    attendances,
    syncStatus: nextSyncStatusAfterEdit(existing),
    lastModifiedAt: new Date().toISOString(),
  }));
}

// Re-marks a session for sync after a local mutation, preserving a not-yet-synced pending_create so
// the session still flows through the create path instead of being PUT before it exists server-side.
function nextSyncStatusAfterEdit(existing: LocalSession): SyncStatus {
  return existing.syncStatus === 'pending_create' ? 'pending_create' : 'pending_update';
}

// Associates a therapeutic tool with a session (idempotent). Mutates the local session's toolIds and
// re-marks it for sync, so the many-to-many link is pushed to the server on the next cycle. Lives in
// the sessions feature because it owns the sessions table; the clinicalTools feature calls it through
// this feature's public façade.
export async function associateToolToSession(sessionId: string, toolId: string): Promise<void> {
  const existing = await db.sessions.get(sessionId);
  if (!existing || existing.toolIds.includes(toolId)) return;

  await db.sessions.put(await encryptSession({
    ...(await decryptSession(existing)),
    toolIds: [...existing.toolIds, toolId],
    syncStatus: nextSyncStatusAfterEdit(existing),
    lastModifiedAt: new Date().toISOString(),
  }));
}

// Removes a tool association from a session (idempotent).
export async function dissociateToolFromSession(sessionId: string, toolId: string): Promise<void> {
  const existing = await db.sessions.get(sessionId);
  if (!existing || !existing.toolIds.includes(toolId)) return;

  await db.sessions.put(await encryptSession({
    ...(await decryptSession(existing)),
    toolIds: existing.toolIds.filter(id => id !== toolId),
    syncStatus: nextSyncStatusAfterEdit(existing),
    lastModifiedAt: new Date().toISOString(),
  }));
}

// Persists a validated AI report onto the session and re-marks it for sync, so the offline-first
// engine pushes the report (and its validation flag) to the server on the next cycle.
export async function updateSessionAiReport(
  id: string,
  aiReport: string,
  isReportValidated: boolean,
): Promise<void> {
  const existing = await db.sessions.get(id);
  if (!existing) return;

  await db.sessions.put(await encryptSession({
    ...(await decryptSession(existing)),
    aiReport,
    isReportValidated,
    syncStatus: nextSyncStatusAfterEdit(existing),
    lastModifiedAt: new Date().toISOString(),
  }));
}

export async function saveNoteLocally(note: LocalNote): Promise<void> {
  await db.notes.put(await encryptNote(note));
}

export async function getNoteForSession(sessionId: string): Promise<LocalNote | undefined> {
  return decryptNote(await db.notes.where('sessionId').equals(sessionId).first());
}

// All patients known locally: the synced server cache PLUS any still pending in the offline creation
// queue, so a session referencing an offline-created patient can still resolve its name. Pending
// entries are de-duplicated against the synced set for the brief overlap right after a sync.
export async function getAllLocalPatients(): Promise<LocalPatientSync[]> {
  const [synced, queued] = await Promise.all([
    db.patients.toArray(),
    db.offlinePatientQueue.toArray(),
  ]);

  const syncedIds = new Set(synced.map(p => p.id));
  const pending: LocalPatientSync[] = queued
    .filter(entry => !syncedIds.has(entry.payload.id))
    .map(entry => ({
      id: entry.payload.id,
      firstName: entry.payload.firstName,
      lastName: entry.payload.lastName,
      searchableName: `${entry.payload.firstName} ${entry.payload.lastName}`.toLowerCase(),
      birthDate: entry.payload.birthDate,
      userRole: 'Admin', // an offline-created patient's creator is always its admin
    }));

  return [...synced, ...pending];
}
