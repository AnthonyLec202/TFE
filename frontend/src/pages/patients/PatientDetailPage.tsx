import { useNavigate, useParams } from 'react-router-dom';
import { PatientDetailContainer } from '../../features/patients';

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) return null;

  return (
    <PatientDetailContainer
      patientId={id}
      onNavigateBack={() => navigate('/')}
    />
  );
}
