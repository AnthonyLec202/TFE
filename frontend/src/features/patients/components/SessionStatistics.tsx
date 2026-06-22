import { Card } from '../../../components/ui/Card';

export interface SessionStatisticsData {
  completedCount: number;
  noShowCount: number;
  cancelledCount: number;
  attendanceRate: number; // percentage, 0-100
}

export interface SessionStatisticsProps {
  statistics: SessionStatisticsData;
}

export function SessionStatistics({ statistics }: SessionStatisticsProps) {
  const { completedCount, noShowCount, cancelledCount, attendanceRate } = statistics;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Card className="p-4 flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-taupe-400">Présent</span>
        <span className="text-2xl font-bold text-ink">{completedCount}</span>
      </Card>
      <Card className="p-4 flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-taupe-400">Absent</span>
        <span className="text-2xl font-bold text-ink">{noShowCount}</span>
      </Card>
      <Card className="p-4 flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-taupe-400">Annulée à l'avance</span>
        <span className="text-2xl font-bold text-ink">{cancelledCount}</span>
      </Card>
      <Card className="p-4 flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-taupe-400">Présence</span>
        <span className="text-2xl font-bold text-ink">{attendanceRate.toFixed(0)}%</span>
      </Card>
    </div>
  );
}
