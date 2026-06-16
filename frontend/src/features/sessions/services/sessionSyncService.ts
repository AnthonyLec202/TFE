import { db, type SyncStatus, type LocalNote } from '../../../core/offline/LocalDatabase';
import { AuthError, HttpError } from '../../../services/apiClient';
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

  // Read pending notes in isolation. The DBCore decryption middleware already neutralises a single
  // corrupted note, but a catastrophic read failure on the notes table must not abort the session
  // push (and, since this whole handler would otherwise throw, fail the entire sync cycle for
  // unrelated tables like patients). On failure we log and proceed with an empty note set.
  let pendingNotes: LocalNote[] = [];
  try {
    pendingNotes = await db.notes.filter(n => n.syncStatus !== 'synced').toArray();
  } catch (error) {
    console.error('[sessionSync] Failed to read pending notes — pushing sessions without them this cycle.', error);
  }

  const deletes = pendingSessions.filter(s => s.syncStatus === 'pending_delete');
  const updates = pendingSessions.filter(s => s.syncStatus === 'pending_update');
  const creates = pendingSessions.filter(s => s.syncStatus === 'pending_create');

  if (deletes.length === 0 && updates.length === 0 && creates.length === 0 && pendingNotes.length === 0) {
    return;
  }

  // 1) Deletions — remove server-side, then purge the local tombstone and its notes. A 404 means the
  // server already lacks the session, so the deletion goal is met: treat it as success and purge
  // locally. Any other failure leaves the tombstone for the next cycle to retry. An AuthError is
  // re-thrown so the engine can escalate to logout rather than swallowing an expired token.
  for (const session of deletes) {
    try {
      await deleteSession(session.id);
    } catch (err) {
      if (err instanceof AuthError) throw err;
      if (!(err instanceof HttpError && err.status === 404)) {
        console.warn('[sessionSync] Failed to delete a session — will retry later.', session.id, err);
        continue;
      }
      console.info('[sessionSync] Session already absent server-side (404) — treating delete as success.', session.id);
    }
    await db.transaction('rw', db.sessions, db.notes, async () => {
      await db.notes.where('sessionId').equals(session.id).delete();
      await db.sessions.delete(session.id);
    });
  }

  // 2) Updates — push each previously-synced session via PUT, then mark it synced. A failure leaves
  // the row pending_update for the next cycle; an AuthError is re-thrown for the engine to escalate.
  for (const session of updates) {
    try {
      await updateSession(session.id, {
        title: session.title,
        date: session.date,
        time: session.time,
        isClosed: session.isClosed,
        patientIds: session.patientIds,
        attendances: session.attendances,
      });
      await db.sessions.update(session.id, { syncStatus: SYNCED });
    } catch (err) {
      if (err instanceof AuthError) throw err;
      console.warn('[sessionSync] Failed to update a session — will retry later.', session.id, err);
    }
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
        isClosed: s.isClosed,
        patientIds: s.patientIds,
        attendances: s.attendances,
      })),
      notes: notesToSync.map(n => ({
        id: n.id,
        sessionId: n.sessionId,
        content: n.content,
        lastModifiedAt: n.lastModifiedAt,
      })),
    };

    // Isolated like the loops above: a failed batch leaves the rows pending for the next cycle, and
    // an AuthError is re-thrown so the engine can escalate to logout.
    try {
      await syncSessionsBatch(payload);

      await db.transaction('rw', db.sessions, db.notes, async () => {
        if (creates.length > 0)
          await db.sessions.bulkPut(creates.map(s => ({ ...s, syncStatus: SYNCED })));
        if (notesToSync.length > 0)
          await db.notes.bulkPut(notesToSync.map(n => ({ ...n, syncStatus: SYNCED })));
      });
    } catch (err) {
      if (err instanceof AuthError) throw err;
      console.warn('[sessionSync] Failed to push the create/notes batch — will retry later.', err);
    }
  }
}
