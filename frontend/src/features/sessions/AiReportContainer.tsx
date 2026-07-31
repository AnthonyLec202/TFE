import { useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../auth';
import { getSessionById, getNoteForSession, updateSessionAiReport } from './services/localSessionService';
import { generateReportLocally, type LocalGenerationHandle } from './services/localAiReportService';
import { reportOllamaOutcome } from './services/ollamaAvailability';
import { useOllamaAvailability } from './hooks/useOllamaAvailability';
import { OllamaError } from '../../services/ollamaClient';
import { runSyncCycle } from '../../core/offline/syncEngine';
import { AiReportWorkspace } from './components/AiReportWorkspace';

// Top-level container for the dedicated AI clinical-report route (/sessions/:sessionId/report).
// Owns data fetching (session + note from the local Dexie mirror), the choice of generation engine,
// and routing; delegates all rendering and the generation UI state machine to AiReportWorkspace.
export function AiReportContainer() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  // Only the practitioner (Admin) may re-run generation over an already-produced report.
  const isAdmin = user?.roles.includes('Admin') ?? false;

  // null while the first probe is in flight. Drives the engine label only — it still never gates the
  // button: a probe false-negative would lock the clinician out of a runtime that actually works, and
  // a failed generation now surfaces its own actionable diagnosis instead.
  const ollamaAvailability = useOllamaAvailability();

  const session = useLiveQuery(() => getSessionById(sessionId!), [sessionId]);
  const note = useLiveQuery(
    () => getNoteForSession(sessionId!).then(existing => existing ?? null),
    [sessionId],
  );

  // A generation runs for tens of seconds. Holding the handle lets us tear the worker down when the
  // clinician navigates away, instead of leaving it burning CPU and posting into a dead component.
  const generationRef = useRef<LocalGenerationHandle | null>(null);
  useEffect(() => () => generationRef.current?.cancel(), []);

  // undefined = still loading; null = confirmed absent.
  if (session === undefined || note === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-taupe-400">Chargement de la séance…</p>
      </div>
    );
  }

  if (session === null) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-taupe-500">Séance introuvable.</p>
      </div>
    );
  }

  const noteContent = note?.content ?? '';

  /**
   * Local model only — there is deliberately no server-side fallback.
   *
   * Generation is a strictly on-device capability: the clinical note is the most sensitive payload
   * the application handles, and confining inference to the clinician's own machine means it never
   * leaves it. Falling back to a remote engine would silently undo that guarantee at the exact moment
   * the clinician is least likely to notice — when the local runtime is down.
   *
   * Every failure therefore surfaces. `OllamaError.hint` is populated for all three failure kinds by
   * `toOllamaError`, so it is already the most precise guidance available: the environment-level
   * diagnosis for `unreachable` (Ollama stopped, or its OLLAMA_ORIGINS not naming this origin), and
   * the specific cause for an `http`/`protocol` failure, where the runtime did answer.
   *
   * A partial result from a failed generation is left on screen, matching the pre-existing behaviour
   * for surfaced errors — only the removed fallback path had a reason to discard it.
   */
  const handleGenerate = async (onProgress: (partial: string) => void): Promise<string> => {
    generationRef.current?.cancel();

    const handle = generateReportLocally(noteContent, onProgress);
    generationRef.current = handle;

    try {
      const report = await handle.result;
      reportOllamaOutcome(true);
      return report;
    } catch (error) {
      if (!(error instanceof OllamaError)) throw error;

      // Only 'unreachable' proves the runtime is down; an http/protocol failure means it answered,
      // so the availability state stays true and the UI keeps labelling the engine as present.
      reportOllamaOutcome(error.kind !== 'unreachable');

      throw new Error(error.hint || "La génération sur le moteur d'IA local a échoué.", { cause: error });
    } finally {
      generationRef.current = null;
    }
  };

  return (
    <AiReportWorkspace
      sessionId={session.id}
      sessionDate={session.date}
      noteContent={noteContent}
      initialReport={session.aiReport ?? null}
      initialValidated={session.isReportValidated ?? false}
      canRegenerate={isAdmin}
      isLocalEngineAvailable={ollamaAvailability}
      onBack={() => navigate(`/sessions/${session.id}`)}
      onGenerate={handleGenerate}
      // Persist the validated report to Dexie and trigger the offline-first sync engine to push it.
      onSave={async report => {
        await updateSessionAiReport(session.id, report, true);
        runSyncCycle(); // fire-and-forget: push to the server if online
      }}
    />
  );
}
