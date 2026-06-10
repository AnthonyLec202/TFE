import { useLiveQuery } from 'dexie-react-hooks';
import { getSessionsForPatient } from '../sessions';
import { SessionHistoryList } from './components/SessionHistoryList';

interface Props {
  patientId: string;
}

export function SessionHistoryContainer({ patientId }: Props) {
  const sessions = useLiveQuery(
    () => getSessionsForPatient(patientId),
    [patientId],
  );

  return <SessionHistoryList sessions={sessions} />;
}
