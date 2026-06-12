import { db, type SyncStatus } from '../../../core/offline/LocalDatabase';
import { syncSessionsBatch, updateSession, deleteSession } from './sessionApiService';

const SYNCED: SyncStatus = 'synced';

/**
 * Pushes all pending local session changes to the server: deletions, then updates, then creates +
 * notes (batched), marking each as synced locally. Registered with the core sync engine as a sync
 * handler; the engine runs it without knowing what it does. Registration order guarantees this runs
 * after the offline patient queue, so a session referencing an offline-created patient is only
 * pushed once that patient exists server-side.
 */
export async function syncSessions(): Promise<void> {
  const pendingSessions = await db.sessions.filter(s => s.syncStatus !== 'synced').toArray();
  const pendingNotes = await db.notes.filter(n => n.syncStatus !== 'synced').toArray();

  const deletes = pendingSessions.filter(s => s.syncStatus === 'pending_delete');
  const updates = pendingSessions.filter(s => s.syncStatus === 'pending_update');
  const creates = pendingSessions.filter(s => s.syncStatus === 'pending_create');

  if (deletes.length === 0 && updates.length === 0 && creates.length === 0 && pendingNotes.length === 0) {
    return;
  }

  // 1) Deletions — remove server-side, then purge the local tombstone and its notes.
  for (const session of deletes) {
    await deleteSession(session.id);
    await db.transaction('rw', db.sessions, db.notes, async () => {
      await db.notes.where('sessionId').equals(session.id).delete();
      await db.sessions.delete(session.id);
    });
  }

  // 2) Updates — push each previously-synced session via PUT, then mark it synced.
  for (const session of updates) {
    await updateSession(session.id, {
      title: session.title,
      date: session.date,
      time: session.time,
      isCompleted: session.isCompleted,
      patientIds: session.patientIds,
    });
    await db.sessions.update(session.id, { syncStatus: SYNCED });
  }

  // 3) Creates + notes — the batch endpoint upserts new sessions and reconciles notes atomically.
  // Skip notes whose session was just deleted so we never re-create an orphaned note.
  const deletedIds = new Set(deletes.map(s => s.id));
  const notesToSync = pendingNotes.filter(n => !deletedIds.has(n.sessionId));

  if (creates.length > 0 || notesToSync.length > 0) {
    const payload = {
      sessions: creates.map(s => ({
        id: s.id,
        title: s.title,
        date: s.date,
        time: s.time,
        isCompleted: s.isCompleted,
        patientIds: s.patientIds,
      })),
      notes: notesToSync.map(n => ({
        id: n.id,
        sessionId: n.sessionId,
        content: n.content,
        lastModifiedAt: n.lastModifiedAt,
      })),
    };

    await syncSessionsBatch(payload);

    await db.transaction('rw', db.sessions, db.notes, async () => {
      if (creates.length > 0)
        await db.sessions.bulkPut(creates.map(s => ({ ...s, syncStatus: SYNCED })));
      if (notesToSync.length > 0)
        await db.notes.bulkPut(notesToSync.map(n => ({ ...n, syncStatus: SYNCED })));
    });
  }
}
