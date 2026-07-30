import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useGlobalNetworkState } from '../../core/offline/NetworkStateProvider';
import { runSyncCycle } from '../../core/offline/syncEngine';
import {
  getNotesWithPendingStrokes,
  convertPendingStrokes,
  type PendingStrokeNote,
} from './services/pendingStrokesService';
import { HandwritingRecognitionError } from './services/handwritingApiService';
import { PendingStrokesPanel } from './components/PendingStrokesPanel';

// Sub-container for the manual retry of handwriting that was captured but never transcribed —
// typically written offline, or left behind by a conversion that failed. Composed by the sessions
// dashboard; not a page-level entry point, so it is not exported from the feature façade.
//
// Retry is deliberately manual. An automatic pass on reconnection would add a second writer on the
// notes table alongside the sync engine, which is the interleaving that already produced a data-loss
// bug here. See the header of pendingStrokesService for the full rationale.
export function PendingStrokesContainer() {
  const navigate = useNavigate();
  const isOnline = useGlobalNetworkState();

  const pendingNotes = useLiveQuery(() => getNotesWithPendingStrokes());

  const [convertingNoteId, setConvertingNoteId] = useState<string | null>(null);
  const [isConvertingAll, setIsConvertingAll] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Nothing pending (or still loading): render nothing rather than an empty placeholder, so the
  // dashboard stays uncluttered in the normal case.
  if (!pendingNotes || pendingNotes.length === 0) return null;

  /**
   * Converts one note. Returns true on success so the batch runner can keep a tally.
   *
   * The live query drops the row on its own once the strokes are cleared, so there is no local list
   * state to reconcile here.
   */
  async function convertOne(note: PendingStrokeNote): Promise<boolean> {
    setConvertingNoteId(note.noteId);
    setErrors(previous => {
      const next = { ...previous };
      delete next[note.noteId];
      return next;
    });

    try {
      const outcome = await convertPendingStrokes(note.sessionId);

      if (outcome.status === 'empty') {
        setErrors(previous => ({
          ...previous,
          [note.noteId]: "Aucun texte n'a pu être reconnu dans ce tracé. Les tracés sont conservés.",
        }));
        return false;
      }

      if (outcome.status === 'none') {
        // Already handled elsewhere (another tab, or the session workspace). Nothing to report.
        return true;
      }

      runSyncCycle(); // fire-and-forget: push the transcribed note if online
      return true;
    } catch (error) {
      setErrors(previous => ({
        ...previous,
        [note.noteId]: error instanceof HandwritingRecognitionError
          ? error.message
          : 'La conversion a échoué. Vos tracés sont conservés : vous pouvez réessayer.',
      }));
      return false;
    } finally {
      setConvertingNoteId(null);
    }
  }

  /**
   * Converts every pending note, strictly one at a time.
   *
   * Sequential, not parallel: each conversion is a billed provider call behind a per-user rate limit,
   * and serializing them also guarantees a single writer on the notes table at any moment. A failure
   * stops the run rather than burning through the remaining quota on what is most likely the same
   * cause (offline, provider down, misconfiguration) — the ones left keep their strokes and stay
   * listed.
   */
  async function handleConvertAll(): Promise<void> {
    setIsConvertingAll(true);
    try {
      for (const note of pendingNotes ?? []) {
        const succeeded = await convertOne(note);
        if (!succeeded) break;
      }
    } finally {
      setIsConvertingAll(false);
    }
  }

  return (
    <PendingStrokesPanel
      notes={pendingNotes}
      convertingNoteId={convertingNoteId}
      isConvertingAll={isConvertingAll}
      errors={errors}
      isOnline={isOnline}
      onConvert={note => void convertOne(note)}
      onConvertAll={() => void handleConvertAll()}
      onOpenSession={sessionId => navigate(`/sessions/${sessionId}`)}
    />
  );
}
