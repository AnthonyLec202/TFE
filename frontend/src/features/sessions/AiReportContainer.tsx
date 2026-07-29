import { useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../auth';
import { getSessionById, getNoteForSession, updateSessionAiReport } from './services/localSessionService';
import { generateAiReport } from './services/sessionApiService';
import { generateReportLocally, type LocalGenerationHandle } from './services/localAiReportService';
import { reportOllamaOutcome } from './services/ollamaAvailability';
import { useOllamaAvailability } from './hooks/useOllamaAvailability';
import { OllamaError, describeUnreachable } from '../../services/ollamaClient';
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

  // null while the first probe is in flight. Drives the engine label only — never gates the button,
  // because the probe can be wrong and the fallback covers every failure anyway.
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
   * Local model first, server second.
   *
   * The local engine is preferred because it works with no network — the whole point of moving
   * generation client-side. But the browser may refuse to reach the loopback interface at all
   * (mixed content or Private Network Access on an HTTPS deployment), and that refusal is
   * indistinguishable from Ollama simply not being installed. Rather than gate the feature on a
   * capability we cannot reliably detect, we attempt locally and fall back to the backend, which
   * still runs the same model server-side.
   *
   * Only an `unreachable` failure falls back. An HTTP or protocol error means the local runtime DID
   * answer, so the notes already reached it and the problem is a configuration one the clinician
   * should see rather than have papered over by a silent second attempt.
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
      const isUnreachable = error instanceof OllamaError && error.kind === 'unreachable';
      if (error instanceof OllamaError) reportOllamaOutcome(!isUnreachable);

      // A local runtime that answered with an error had the notes and rejected them: surface its
      // guidance rather than papering over a configuration problem with a silent second attempt.
      if (error instanceof OllamaError && !isUnreachable) {
        throw new Error(error.hint || "La génération sur le moteur d'IA local a échoué.", { cause: error });
      }
      if (!isUnreachable) throw error;

      console.info('[AiReport] Local model unreachable — falling back to server-side generation.', error);
      // Clears any partial text the failed attempt produced, so the server result never lands
      // appended to a truncated local one.
      onProgress('');

      try {
        return await generateAiReport(session.id);
      } catch (fallbackError) {
        // Both engines are out. Lead with the local diagnosis, which is the actionable one — the
        // clinician can start Ollama, but not the backend.
        console.warn('[AiReport] Server-side generation also failed.', fallbackError);
        throw new Error(
          `${describeUnreachable()} La génération sur le serveur a également échoué : vérifiez votre connexion.`,
          { cause: fallbackError },
        );
      }
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
