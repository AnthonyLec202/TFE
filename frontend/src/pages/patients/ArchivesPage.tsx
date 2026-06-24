import { useNavigate } from 'react-router-dom';
import { PatientArchivesContainer } from '../../features/patients';

export function ArchivesPage() {
  const navigate = useNavigate();

  return (
    <PatientArchivesContainer
      // Carry the origin so the dossier's back arrow returns to /archives rather than the default list.
      onSelectPatient={id => navigate(`/patients/${id}`, { state: { from: '/archives' } })}
    />
  );
}
