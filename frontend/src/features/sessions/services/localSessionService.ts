import { db } from '../../../core/offline/LocalDatabase';
import type { LocalNote, LocalPatientSync, LocalSession, LocalSessionAttendance, SyncStatus } from '../../../core/offline/LocalDatabase';

export interface SessionEditableFields {
  title: string;
  date: string;
  time: string;
  patientIds: string[];
}

export async function createSession(session: LocalSession): Promise<void> {
  await db.sessions.put(session);
}

export async function getSessionById(sessionId: string): Promise<LocalSession | undefined> {
  const session = await db.sessions.get(sessionId);
  // A tombstoned (pending_delete) session is treated as already gone.
  if (!session || session.syncStatus === 'pending_delete') return undefined;
  return session;
}

export async function getAllSessions(): Promise<LocalSession[]> {
  const sessions = await db.sessions.orderBy('date').reverse().toArray();
  // The general dashboard shows only ACTIVE work: exclude closed sessions (archived to the
  // patients' history) and any awaiting server-side deletion so they vanish immediately.
  return sessions.filter(s => !s.isClosed && s.syncStatus !== 'pending_delete');
}

export async function updateSessionLocally(id: string, changes: SessionEditableFields): Promise<void> {
  const existing = await db.sessions.get(id);
  if (!existing) return;

  // Preserve pending_create so a not-yet-synced session still flows through the create path;
  // otherwise mark it pending_update for the SyncEngine to push via PUT.
  const syncStatus: SyncStatus = existing.syncStatus === 'pending_create' ? 'pending_create' : 'pending_update';

  await db.sessions.put({
    ...existing,
    ...changes,
    syncStatus,
    lastModifiedAt: new Date().toISOString(),
  });
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
  await db.sessions.put({
    ...existing,
    syncStatus: 'pending_delete',
    lastModifiedAt: new Date().toISOString(),
  });
}

export async function getSessionsForPatient(patientId: string): Promise<LocalSession[]> {
  const sessions = await db.sessions.where('patientIds').equals(patientId).toArray();
  // A patient's history holds any closed session; exclude tombstoned ones.
  return sessions.filter(s => s.isClosed && s.syncStatus !== 'pending_delete');
}

// Close a session with its per-patient attendance outcomes, archiving it to the patients' history.
export async function closeSessionLocally(id: string, attendances: LocalSessionAttendance[]): Promise<void> {
  const existing = await db.sessions.get(id);
  if (!existing) return;

  // Preserve pending_create so a not-yet-synced session still flows through the create path;
  // otherwise mark it pending_update for the SyncEngine to push the closure via PUT.
  const syncStatus: SyncStatus = existing.syncStatus === 'pending_create' ? 'pending_create' : 'pending_update';

  await db.sessions.put({
    ...existing,
    isClosed: true,
    attendances,
    syncStatus,
    lastModifiedAt: new Date().toISOString(),
  });
}

export async function saveNoteLocally(note: LocalNote): Promise<void> {
  await db.notes.put(note);
}

export async function getNoteForSession(sessionId: string): Promise<LocalNote | undefined> {
  return db.notes.where('sessionId').equals(sessionId).first();
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
