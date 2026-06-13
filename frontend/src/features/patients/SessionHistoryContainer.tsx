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
    let completedCount = 0;
    let noShowCount = 0;
    let cancelledCount = 0;

    // Tally only THIS patient's outcomes. A group session holds one attendance per participant, so
    // we strictly filter on attendance.patientId === patientId to prevent other patients' statuses
    // from leaking into this patient's statistics.
    for (const session of sessions ?? []) {
      for (const attendance of session.attendances) {
        if (attendance.patientId !== patientId) continue;
        if (attendance.status === SessionStatus.Completed) completedCount++;
        else if (attendance.status === SessionStatus.NoShow) noShowCount++;
        else if (attendance.status === SessionStatus.PatientCancelled) cancelledCount++;
      }
    }

    const totalCount = completedCount + noShowCount + cancelledCount;
    const attendanceRate = totalCount === 0 ? 0 : (completedCount / totalCount) * 100;

    return { completedCount, noShowCount, cancelledCount, attendanceRate };
  }, [sessions, patientId]);

  // Returning from a session opened here lands back on this patient's record.
  const backOrigin: SessionDetailOrigin = {
    from: `/patients/${patientId}`,
    label: patientName,
  };

  return (
    <div className="flex flex-col gap-4">
      <SessionStatistics statistics={statistics} />
      <SessionHistoryList sessions={sessions} patientId={patientId} backOrigin={backOrigin} />
    </div>
  );
}
