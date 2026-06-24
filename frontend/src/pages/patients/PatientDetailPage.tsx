import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { PatientDetailContainer } from '../../features/patients';

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Origin injected by the view that opened this dossier (e.g. /archives). Falls back to the patients
  // list when navigated to directly (deep link, reload) or when no origin was provided.
  const from = (location.state as { from?: string } | null)?.from;

  if (!id) return null;

  return (
    <PatientDetailContainer
      patientId={id}
      onNavigateBack={() => navigate(from ?? '/patients')}
    />
  );
}
