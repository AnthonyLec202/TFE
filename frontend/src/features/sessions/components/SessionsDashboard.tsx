import { Calendar, Clock, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import type { LocalSession } from '../../../core/offline/LocalDatabase';

export interface SessionsDashboardProps {
  sessions: LocalSession[] | undefined;
}

export function SessionsDashboard({ sessions }: SessionsDashboardProps) {
  if (sessions === undefined) {
    return <p className="text-sm text-slate-400">Loading sessions…</p>;
  }

  if (sessions.length === 0) {
    return (
      <Card className="p-8 flex items-center justify-center">
        <p className="text-sm text-slate-400">No sessions yet. Create your first one.</p>
      </Card>
    );
  }

  return (
    <>
      {sessions.map(session => (
        <Link key={session.id} to={`/sessions/${session.id}`} className="block group">
          <Card className="p-4 flex flex-col gap-2 group-hover:border-blue-200 group-hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800 leading-snug group-hover:text-blue-700 transition-colors">
                {session.title}
              </h3>
              {session.syncStatus !== 'synced' && (
                <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                  pending
                </span>
              )}
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
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {session.patientIds.length} patient{session.patientIds.length !== 1 ? 's' : ''}
              </span>
            </div>
          </Card>
        </Link>
      ))}
    </>
  );
}
