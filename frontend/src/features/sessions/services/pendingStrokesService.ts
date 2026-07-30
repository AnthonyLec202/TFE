/**
 * Conversion of not-yet-recognized strokes, and the inventory of notes still holding some.
 *
 * WHY MANUAL, AND NOT A BACKGROUND JOB
 * The obvious design — retry automatically on reconnection, from the sync engine or a Background
 * Sync event — would introduce a second writer on the notes table running concurrently with
 * syncSessions and syncNotesFromServer. That is exactly the interleaving that already cost a
 * data-loss bug here: a push snapshot taken before the conversion, acknowledged after it, marking
 * the row synced while the server never received the recognized text. A Service Worker could not
 * even do the work — the at-rest encryption key lives in the window context and is never serialized,
 * so the worker cannot read a stroke payload or write one back.
 *
 * So conversion stays user-triggered, and this module is written to be the only writer at a time:
 * an in-flight guard rejects a second attempt on the same note, the batch retry is strictly
 * sequential, and the write-back is a compare-and-swap that abandons rather than overwrite work
 * that landed meanwhile.
 */
import { db } from '../../../core/offline/LocalDatabase';
import { decryptNotes } from '../../../core/offline/recordEncryption';
import { getNoteForSession, saveNoteLocally } from './localSessionService';
import { recognizeBatch, HandwritingRecognitionError } from './handwritingApiService';
import { appendRecognizedTextToHtml } from '../utils/htmlContent';
import { parsePendingStrokes, countPoints } from '../utils/pendingStrokes';

/** A note still holding strokes that were never turned into text. */
export interface PendingStrokeNote {
  noteId: string;
  sessionId: string;
  sessionTitle: string;
  /** ISO date of the parent session, for ordering and display. */
  sessionDate: string;
  strokeCount: number;
  pointCount: number;
}

export type ConversionOutcome =
  /** Recognized; `content` is the note's new HTML, already persisted. */
  | { status: 'converted'; content: string }
  /** The provider returned nothing legible. Strokes are kept so the clinician can retry or rewrite. */
  | { status: 'empty' }
  /** Nothing left to convert — the note vanished, or another actor already handled it. */
  | { status: 'none' };

/** Note ids with a conversion in flight, so a double click cannot bill the provider twice. */
const inFlight = new Set<string>();

/**
 * Lists every note carrying unconverted strokes, newest session first.
 *
 * Filters on the raw rows before decrypting: `unprocessedStrokes` is encrypted at rest, but its
 * mere presence is visible without the key, so notes that never held strokes cost no WebCrypto call.
 */
export async function getNotesWithPendingStrokes(): Promise<PendingStrokeNote[]> {
  const [rawNotes, sessions] = await Promise.all([db.notes.toArray(), db.sessions.toArray()]);

  const candidates = rawNotes.filter(
    note => typeof note.unprocessedStrokes === 'string' && note.unprocessedStrokes.length > 0,
  );
  if (candidates.length === 0) return [];

  const sessionsById = new Map(sessions.map(session => [session.id, session]));
  const decrypted = await decryptNotes(candidates);
  const pending: PendingStrokeNote[] = [];

  for (const note of decrypted) {
    const { strokes } = parsePendingStrokes(note.unprocessedStrokes);
    if (strokes.length === 0) continue; // an emptied payload ("[]") or a corrupt one

    const session = sessionsById.get(note.sessionId);
    // A tombstoned session is on its way out; converting its note would be wasted work.
    if (!session || session.syncStatus === 'pending_delete') continue;

    pending.push({
      noteId: note.id,
      sessionId: note.sessionId,
      sessionTitle: session.title,
      sessionDate: session.date,
      strokeCount: strokes.length,
      pointCount: countPoints(strokes),
    });
  }

  return pending.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
}

/**
 * Recognizes a note's pending strokes and folds the text into its content.
 *
 * @param sessionId       Session owning the note.
 * @param baseContentOverride
 *   Content to append to, when the caller holds a fresher copy than the database — the workspace
 *   editor debounces its saves by a second, so the stored content can lag what is on screen.
 *   Omitted, the persisted content is used.
 *
 * @throws {HandwritingRecognitionError} with a message already written for the clinician.
 */
export async function convertPendingStrokes(
  sessionId: string,
  baseContentOverride?: string,
): Promise<ConversionOutcome> {
  const note = await getNoteForSession(sessionId);
  if (!note) return { status: 'none' };

  if (inFlight.has(note.id)) {
    throw new HandwritingRecognitionError('Une conversion est déjà en cours pour cette séance.');
  }
  inFlight.add(note.id);

  try {
    const pending = parsePendingStrokes(note.unprocessedStrokes);
    if (pending.strokes.length === 0) return { status: 'none' };

    // Snapshot taken before the network round-trip; the write-back below verifies it still holds.
    const snapshotModifiedAt = note.lastModifiedAt;

    const recognized = await recognizeBatch(pending.strokes, pending.width, pending.height);
    if (recognized.trim().length === 0) return { status: 'empty' };

    // Re-read: recognition takes seconds, during which a sync pull or another tab may have rewritten
    // the row. Abandoning is the safe outcome — the strokes survive and the clinician can retry —
    // whereas writing would clobber whatever landed in between.
    const current = await getNoteForSession(sessionId);
    if (!current || current.id !== note.id) return { status: 'none' };
    if (current.lastModifiedAt !== snapshotModifiedAt) {
      throw new HandwritingRecognitionError(
        'La note a été modifiée pendant la conversion. Vos tracés sont conservés : réessayez.',
      );
    }

    const content = appendRecognizedTextToHtml(baseContentOverride ?? current.content, recognized);

    await saveNoteLocally({
      ...current,
      content,
      unprocessedStrokes: '[]',
      syncStatus: 'pending_update',
      lastModifiedAt: new Date().toISOString(),
    });

    return { status: 'converted', content };
  } finally {
    inFlight.delete(note.id);
  }
}
