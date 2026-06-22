import { useNavigate, useParams } from 'react-router-dom';
import { ToolDetailContainer } from '../../features/clinicalTools';

export function ToolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    navigate('/clinical-tools', { replace: true });
    return null;
  }

  return <ToolDetailContainer toolId={id} onBack={() => navigate('/clinical-tools')} />;
}
