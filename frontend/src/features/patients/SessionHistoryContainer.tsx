import { useLiveQuery } from 'dexie-react-hooks';
import { getSessionsForPatient } from '../sessions';
import type { SessionDetailOrigin } from '../../types/navigation';
import { SessionHistoryList } from './components/SessionHistoryList';

interface Props {
  patientId: string;
  patientName: string;
}

export function SessionHistoryContainer({ patientId, patientName }: Props) {
  const sessions = useLiveQuery(
    () => getSessionsForPatient(patientId),
    [patientId],
  );

  // Returning from a session opened here lands back on this patient's record.
  const backOrigin: SessionDetailOrigin = {
    from: `/patients/${patientId}`,
    label: patientName,
  };

  return <SessionHistoryList sessions={sessions} backOrigin={backOrigin} />;
}
