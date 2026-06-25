import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSessionById, getNoteForSession } from './services/localSessionService';
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
      sessionDate={session.date}
      noteContent={note?.content ?? ''}
      onBack={() => navigate(`/sessions/${session.id}`)}
    />
  );
}
