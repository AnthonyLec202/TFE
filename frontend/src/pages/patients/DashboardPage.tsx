import { useNavigate } from 'react-router-dom';
import { DashboardContainer } from '../../features/patients';

export function DashboardPage() {
  const navigate = useNavigate();
  return <DashboardContainer onSelectPatient={id => navigate(`/patients/${id}`)} />;
}
