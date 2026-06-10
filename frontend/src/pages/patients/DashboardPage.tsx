import { useNavigate } from 'react-router-dom';
import { PatientsDashboardContainer } from '../../features/patients';

export function DashboardPage() {
  const navigate = useNavigate();

  return (
    <PatientsDashboardContainer
      onSelectPatient={id => navigate(`/patients/${id}`)}
    />
  );
}
