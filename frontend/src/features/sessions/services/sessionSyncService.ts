import { db, type SyncStatus, type LocalNote, type LocalSession } from '../../../core/offline/LocalDatabase';
import {
  encryptNote,
  encryptSession,
  decryptNotes,
  decryptSessions,
} from '../../../core/offline/recordEncryption';
import { AuthError, HttpError } from '../../../services/apiClient';
import { syncSessionsBatch, updateSession, deleteSession, getSessions, getSessionNotes } from './sessionApiService';

const SYNCED: SyncStatus = 'synced';

/**
 * Clears a session's pending flag only if the row has not been rewritten since the snapshot the push
 * was built from.
 *
 * The payload sent to the server is a snapshot taken at the top of the cycle. A local mutation that
 * lands while that request is in flight — notably a long-running AI report generation — bumps
 * lastModifiedAt. Marking such a row synced would strand changes the server never received, and the
 * hydration phase later in the same cycle, seeing syncStatus === 'synced', would overwrite them with
 * the older server copy. On a mismatch the row simply stays pending and the next cycle pushes it.
 *
 * Patches syncStatus alone rather than writing the snapshot back, so a concurrent edit to any other
 * field survives too.
 *
 * Reads the row raw, on purpose: only lastModifiedAt is compared and it is never encrypted. Nothing
 * here may decrypt — this runs inside a transaction, which cannot survive an await on WebCrypto.
 */
async function markSessionSyncedIfUnchanged(snapshot: LocalSession): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const current = await db.sessions.get(snapshot.id);
    if (!current || current.lastModifiedAt !== snapshot.lastModifiedAt) return;
    await db.sessions.update(snapshot.id, { syncStatus: SYNCED });
  });
}

/** Note-table counterpart of {@link markSessionSyncedIfUnchanged}, guarding concurrent note edits. */
async function markNoteSyncedIfUnchanged(snapshot: LocalNote): Promise<void> {
  await db.transaction('rw', db.notes, async () => {
    const current = await db.notes.get(snapshot.id);
    if (!current || current.lastModifiedAt !== snapshot.lastModifiedAt) return;
    await db.notes.update(snapshot.id, { syncStatus: SYNCED });
  });
}

/**
 * Pushes all pending local session changes to the server: deletions, then updates, then creates +
 * notes (batched), marking each as synced locally. Registered with the core sync engine as a sync
 * handler; the engine runs it without knowing what it does. Registration order guarantees this runs
 * after the offline patient queue, so a session referencing an offline-created patient is only
 * pushed once that patient exists server-side.
 */
export async function syncSessions(): Promise<void> {
  // Decrypted immediately: these rows become the request payloads below, and the server stores and
  // returns cleartext. Pushing the at-rest ciphertext would corrupt the server copy irrecoverably.
  // syncStatus and lastModifiedAt are not encrypted, so filtering before decrypting is safe.
  const pendingSessions = await decryptSessions(
    await db.sessions.filter(s => s.syncStatus !== 'synced').toArray(),
  );

  // Read pending notes in isolation. decryptNotes already neutralises a single corrupted note, but a
  // catastrophic read failure on the notes table must not abort the session push (and, since this
  // whole handler would otherwise throw, fail the entire sync cycle for unrelated tables like
  // patients). On failure we log and proceed with an empty note set.
  let pendingNotes: LocalNote[] = [];
  try {
    pendingNotes = await decryptNotes(await db.notes.filter(n => n.syncStatus !== 'synced').toArray());
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
        aiReport: session.aiReport,
        isReportValidated: session.isReportValidated,
        patientIds: session.patientIds,
        toolIds: session.toolIds,
        attendances: session.attendances,
      });
      await markSessionSyncedIfUnchanged(session);
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
        aiReport: s.aiReport,
        isReportValidated: s.isReportValidated,
        patientIds: s.patientIds,
        toolIds: s.toolIds,
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

      // Per-row compare-and-swap rather than a bulkPut of the snapshots. Writing the snapshots back
      // wholesale would revert every field a concurrent edit touched during the push, not just
      // syncStatus. A row that moved on stays pending and is re-pushed next cycle — the batch
      // endpoint upserts, so a repeated push is idempotent.
      for (const session of creates) await markSessionSyncedIfUnchanged(session);
      for (const note of notesToSync) await markNoteSyncedIfUnchanged(note);
    } catch (err) {
      if (err instanceof AuthError) throw err;
      console.warn('[sessionSync] Failed to push the create/notes batch — will retry later.', err);
    }
  }
}

/**
 * Post-sync hydration (cross-device read): pulls the authoritative, server-decrypted sessions and
 * reconciles them into Dexie. MUST run before {@link syncNotesFromServer} so a pulled note's parent
 * session already exists locally (preserving referential integrity the workspace relies on).
 *
 * Reconciliation rules (identical safety guarantees to the notes pull):
 *  - A session with unsynced local changes (syncStatus !== 'synced', i.e. pending_create/update/delete)
 *    is left untouched: local pending work always wins until pushed, so a pull never resurrects a
 *    tombstone nor clobbers an in-progress edit.
 *  - Otherwise the server record is upserted as 'synced'.
 *  - Locally-cached 'synced' sessions absent server-side (deleted on another device) are pruned;
 *    their now-orphaned notes are pruned by syncNotesFromServer immediately afterwards in the cycle.
 *
 * The server Session carries no modified timestamp, so the local lastModifiedAt is preserved when a
 * row already exists, else stamped at hydration time.
 */
export async function syncSessionsFromServer(): Promise<void> {
  const serverSessions = await getSessions();
  const serverIds = new Set(serverSessions.map(s => s.id));

  // Merge and encrypt every candidate BEFORE opening the transaction. WebCrypto returns a native
  // promise, and awaiting one inside a Dexie transaction lets IndexedDB commit it mid-flight. The
  // local rows read here are only inspected on cleartext fields (syncStatus, lastModifiedAt), so
  // they need no decryption.
  const candidates: LocalSession[] = [];
  for (const serverSession of serverSessions) {
    const local = await db.sessions.get(serverSession.id);

    // Never overwrite an un-pushed local mutation with the (older) server copy.
    if (local && local.syncStatus !== SYNCED) continue;

    candidates.push(await encryptSession({
      id: serverSession.id,
      title: serverSession.title,
      date: serverSession.date,
      time: serverSession.time,
      patientIds: serverSession.patientIds,
      toolIds: serverSession.toolIds,
      isClosed: serverSession.isClosed,
      attendances: serverSession.attendances,
      aiReport: serverSession.aiReport ?? undefined,
      isReportValidated: serverSession.isReportValidated,
      syncStatus: SYNCED,
      lastModifiedAt: local?.lastModifiedAt ?? new Date().toISOString(),
    }));
  }

  await db.transaction('rw', db.sessions, async () => {
    for (const candidate of candidates) {
      // Re-check under the transaction: a local mutation may have landed while we were encrypting,
      // and it must still win over the server copy.
      const current = await db.sessions.get(candidate.id);
      if (current && current.syncStatus !== SYNCED) continue;
      await db.sessions.put(candidate);
    }

    // Prune sessions that are synced locally but absent server-side (deleted elsewhere). Pending local
    // sessions (never pushed, or tombstoned) are never pruned — they have not been reconciled yet.
    // Patient-less drafts are returned by GET /api/sessions via their CreatedById owner, so their
    // absence here is now a genuine deletion signal — no special-case guard needed.
    const localSessions = await db.sessions.toArray();
    const staleIds = localSessions
      .filter(s => s.syncStatus === SYNCED && !serverIds.has(s.id))
      .map(s => s.id);
    if (staleIds.length > 0) await db.sessions.bulkDelete(staleIds);
  });
}

/**
 * Post-sync hydration (cross-device read): pulls the authoritative, server-decrypted session notes
 * and reconciles them into Dexie. Registered as a post-sync handler so it runs once per cycle AFTER
 * the push phase — by which point any locally-authored note has already been marked 'synced'.
 *
 * Reconciliation rules:
 *  - A note with unsynced local changes (syncStatus !== 'synced') is left untouched: a local pending
 *    edit always wins over the server copy until it is pushed, so cross-device pull never clobbers
 *    in-progress work.
 *  - Otherwise the server record is upserted as 'synced'. The plaintext `content` returned by the
 *    server is encrypted to the `$enc$` at-rest format before it is written.
 *  - Locally-cached 'synced' notes that no longer exist server-side (deleted on another device) are
 *    pruned. Pending local notes (never yet pushed) are preserved.
 *
 * `unprocessedStrokes` is a device-local, pre-recognition artifact the server does not persist, so any
 * existing local strokes are carried over rather than dropped on hydration.
 */
export async function syncNotesFromServer(): Promise<void> {
  const serverNotes = await getSessionNotes();
  const serverIds = new Set(serverNotes.map(n => n.id));

  // Merged and encrypted ahead of the transaction, for the same reason as syncSessionsFromServer.
  const candidates: LocalNote[] = [];
  for (const serverNote of serverNotes) {
    const local = await db.notes.get(serverNote.id);

    // Never overwrite an un-pushed local edit with the (older) server copy.
    if (local && local.syncStatus !== SYNCED) continue;

    // `content` arrives from the server as cleartext and is encrypted here. `unprocessedStrokes` is
    // carried over straight from the raw local row, so it is already ciphertext — encryptNote's
    // sentinel guard leaves it untouched rather than encrypting it a second time.
    candidates.push(await encryptNote({
      id: serverNote.id,
      sessionId: serverNote.sessionId,
      content: serverNote.content,
      syncStatus: SYNCED,
      lastModifiedAt: serverNote.lastModifiedAt,
      unprocessedStrokes: local?.unprocessedStrokes,
    }));
  }

  await db.transaction('rw', db.notes, async () => {
    for (const candidate of candidates) {
      // Re-check under the transaction: a local edit may have landed while we were encrypting.
      const current = await db.notes.get(candidate.id);
      if (current && current.syncStatus !== SYNCED) continue;
      await db.notes.put(candidate);
    }

    // Prune notes that are synced locally but absent server-side (deleted elsewhere). Pending local
    // notes are never pruned — they have not reached the server yet. Notes on patient-less drafts are
    // now returned by the notes GET (their session is owner-scoped via CreatedById), so no guard.
    const localNotes = await db.notes.toArray();
    const staleIds = localNotes
      .filter(n => n.syncStatus === SYNCED && !serverIds.has(n.id))
      .map(n => n.id);
    if (staleIds.length > 0) await db.notes.bulkDelete(staleIds);
  });
}
