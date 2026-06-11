import { Calendar, Clock, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import type { LocalSession } from '../../../core/offline/LocalDatabase';
import type { SessionDetailOrigin } from '../../../types/navigation';

export interface SessionHistoryListProps {
  sessions: LocalSession[] | undefined;
  /** Origin passed to the Session Detail view so its Back button returns here. */
  backOrigin: SessionDetailOrigin;
}

export function SessionHistoryList({ sessions, backOrigin }: SessionHistoryListProps) {
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
        <p className="text-sm text-slate-400">No sessions recorded for this patient yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sessions.map(session => (
        <Link
          key={session.id}
          to={`/sessions/${session.id}`}
          state={backOrigin}
          className="block group"
        >
          <Card className="p-4 flex flex-col gap-2 group-hover:border-blue-200 group-hover:shadow-sm transition-shadow">
            <h3 className="text-sm font-semibold text-slate-800 leading-snug group-hover:text-blue-700 transition-colors">
              {session.title}
            </h3>
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
      ))}
    </div>
  );
}
