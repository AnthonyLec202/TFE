import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSessionsForPatient } from '../sessions';
import { SessionStatus } from '../../core/offline/LocalDatabase';
import type { SessionDetailOrigin } from '../../types/navigation';
import { SessionHistoryList } from './components/SessionHistoryList';
import { SessionStatistics, type SessionStatisticsData } from './components/SessionStatistics';

interface Props {
  patientId: string;
  patientName: string;
}

export function SessionHistoryContainer({ patientId, patientName }: Props) {
  const sessions = useLiveQuery(
    () => getSessionsForPatient(patientId),
    [patientId],
  );

  const statistics = useMemo<SessionStatisticsData>(() => {
    const completedCount = sessions?.filter(s => s.status === SessionStatus.Completed).length ?? 0;
    const noShowCount = sessions?.filter(s => s.status === SessionStatus.NoShow).length ?? 0;
    const cancelledCount = sessions?.filter(s => s.status === SessionStatus.PatientCancelled).length ?? 0;
    const totalCount = completedCount + noShowCount + cancelledCount;
    const attendanceRate = totalCount === 0 ? 0 : (completedCount / totalCount) * 100;

    return { completedCount, noShowCount, cancelledCount, attendanceRate };
  }, [sessions]);

  // Returning from a session opened here lands back on this patient's record.
  const backOrigin: SessionDetailOrigin = {
    from: `/patients/${patientId}`,
    label: patientName,
  };

  return (
    <div className="flex flex-col gap-4">
      <SessionStatistics statistics={statistics} />
      <SessionHistoryList sessions={sessions} backOrigin={backOrigin} />
    </div>
  );
}
