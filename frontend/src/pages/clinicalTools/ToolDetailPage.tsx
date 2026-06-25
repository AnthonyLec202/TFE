import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ToolDetailContainer } from '../../features/clinicalTools';

export function ToolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // When the user arrived from a session's tool list, that session's id is carried in router state.
  // It drives a contextual "back to session" return path; otherwise we fall back to the tools catalog.
  const fromSessionId = (location.state as { fromSessionId?: string } | null)?.fromSessionId;
  const backTo = fromSessionId ? `/sessions/${fromSessionId}` : '/clinical-tools';
  const backLabel = fromSessionId ? 'Retour à la séance' : 'Mes outils';

  if (!id) {
    navigate('/clinical-tools', { replace: true });
    return null;
  }

  return <ToolDetailContainer toolId={id} backLabel={backLabel} onBack={() => navigate(backTo)} />;
}
