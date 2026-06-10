import Dexie from 'dexie';
import { db, type SyncStatus } from './LocalDatabase';
import { syncSessionsBatch } from '../../features/sessions';

export async function runSyncCycle(): Promise<void> {
  if (!navigator.onLine) return;

  try {
    await db.transaction('rw', db.sessions, db.notes, async () => {
      const pendingSessions = await db.sessions
        .filter(s => s.syncStatus !== 'synced')
        .toArray();
      const pendingNotes = await db.notes
        .filter(n => n.syncStatus !== 'synced')
        .toArray();

      if (pendingSessions.length === 0 && pendingNotes.length === 0) return;

      const payload = {
        sessions: pendingSessions.map(s => ({
          id: s.id,
          title: s.title,
          date: s.date,
          time: s.time,
          patientIds: s.patientIds,
        })),
        notes: pendingNotes.map(n => ({
          id: n.id,
          sessionId: n.sessionId,
          content: n.content,
          lastModifiedAt: n.lastModifiedAt,
        })),
      };

      // Dexie.waitFor keeps the IDB transaction alive across the external fetch await.
      await Dexie.waitFor(syncSessionsBatch(payload));

      const synced: SyncStatus = 'synced';
      await db.sessions.bulkPut(pendingSessions.map(s => ({ ...s, syncStatus: synced })));
      await db.notes.bulkPut(pendingNotes.map(n => ({ ...n, syncStatus: synced })));
    });
  } catch (err) {
    console.warn('[SyncEngine] Sync cycle failed — will retry next time.', err);
  }
}
