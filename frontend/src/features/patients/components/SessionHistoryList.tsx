import { Calendar, Clock, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { SessionStatus } from '../../../core/offline/LocalDatabase';
import type { LocalSession } from '../../../core/offline/LocalDatabase';
import type { SessionDetailOrigin } from '../../../types/navigation';

export interface SessionHistoryListProps {
  sessions: LocalSession[] | undefined;
  /** Patient whose attendance outcome is colour-coded on each card. */
  patientId: string;
  /** Origin passed to the Session Detail view so its Back button returns here. */
  backOrigin: SessionDetailOrigin;
}

/** Maps a patient's attendance outcome to a label, chip styling, and card left-border accent. */
interface AttendanceVisuals {
  label: string;
  chipClass: string;
  borderClass: string;
}

function resolveAttendanceVisuals(status: SessionStatus | undefined): AttendanceVisuals {
  switch (status) {
    case SessionStatus.Completed:
      return {
        label: 'Présent',
        chipClass: 'bg-emerald-50 text-emerald-700 border-emerald-300',
        borderClass: 'border-l-4 border-l-emerald-400',
      };
    case SessionStatus.NoShow:
      return {
        label: 'Absent',
        chipClass: 'bg-red-50 text-red-700 border-red-300',
        borderClass: 'border-l-4 border-l-red-400',
      };
    case SessionStatus.PatientCancelled:
      return {
        label: 'Annulé',
        chipClass: 'bg-amber-50 text-amber-700 border-amber-300',
        borderClass: 'border-l-4 border-l-amber-400',
      };
    default:
      return {
        label: 'Indéfini',
        chipClass: 'bg-slate-50 text-slate-500 border-slate-200',
        borderClass: '',
      };
  }
}

export function SessionHistoryList({ sessions, patientId, backOrigin }: SessionHistoryListProps) {
  if (sessions === undefined) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-slate-400">Loading session history…</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <FileText className="h-8 w-8 text-slate-300" />
        <p className="text-sm text-slate-400">Aucune séance pour ce patient.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sessions.map(session => {
        const status = session.attendances.find(a => a.patientId === patientId)?.status;
        const visuals = resolveAttendanceVisuals(status);
        return (
          <Link
            key={session.id}
            to={`/sessions/${session.id}`}
            state={backOrigin}
            className="block group"
          >
            <Card className={`p-4 flex flex-col gap-2 group-hover:border-blue-200 group-hover:shadow-sm transition-shadow ${visuals.borderClass}`}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-800 leading-snug group-hover:text-blue-700 transition-colors">
                  {session.title}
                </h3>
                <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border ${visuals.chipClass}`}>
                  {visuals.label}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {session.date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {session.time}
                </span>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
