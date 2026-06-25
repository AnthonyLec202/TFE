import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSessionById, getNoteForSession, updateSessionAiReport } from './services/localSessionService';
import { generateAiReport } from './services/sessionApiService';
import { runSyncCycle } from '../../core/offline/syncEngine';
import { AiReportWorkspace } from './components/AiReportWorkspace';

// Top-level container for the dedicated AI clinical-report route (/sessions/:sessionId/report).
// Owns data fetching (session + note from the local Dexie mirror) and routing; delegates all
// rendering and the generation UI state machine to the presentational AiReportWorkspace.
export function AiReportContainer() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const session = useLiveQuery(() => getSessionById(sessionId!), [sessionId]);
  const note = useLiveQuery(
    () => getNoteForSession(sessionId!).then(existing => existing ?? null),
    [sessionId],
  );

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

  return (
    <AiReportWorkspace
      sessionId={session.id}
      sessionDate={session.date}
      noteContent={note?.content ?? ''}
      initialReport={session.aiReport ?? null}
      initialValidated={session.isReportValidated ?? false}
      onBack={() => navigate(`/sessions/${session.id}`)}
      // Online-only generation: the model runs on the backend. Returns the Markdown report.
      onGenerate={() => generateAiReport(session.id)}
      // Persist the validated report to Dexie and trigger the offline-first sync engine to push it.
      onSave={async report => {
        await updateSessionAiReport(session.id, report, true);
        runSyncCycle(); // fire-and-forget: push to the server if online
      }}
    />
  );
}
