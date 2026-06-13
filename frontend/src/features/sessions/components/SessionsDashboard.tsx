import { Card } from '../../../components/ui/Card';
import type { LocalSession, SessionStatus } from '../../../core/offline/LocalDatabase';
import { SessionCard } from './SessionCard';

export interface SessionGroup {
  key: string;
  label: string;
  sessions: LocalSession[];
}

export interface SessionsDashboardProps {
  groups: SessionGroup[];
  patientNamesById: Map<string, string>;
  isLoading: boolean;
  /** Persists the selected attendance status, archiving the session to the patient's history. */
  onCompleteSession: (id: string, status: SessionStatus) => void;
}

export function SessionsDashboard({ groups, patientNamesById, isLoading, onCompleteSession }: SessionsDashboardProps) {
  if (isLoading) {
    return <p className="text-sm text-slate-400">Loading sessions…</p>;
  }

  if (groups.length === 0) {
    return (
      <Card className="p-8 flex items-center justify-center">
        <p className="text-sm text-slate-400">No sessions match the current filters.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map(group => (
        <section key={group.key} className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {group.label}
          </h2>

          {group.sessions.map(session => (
            <SessionCard
              key={session.id}
              session={session}
              patientNamesById={patientNamesById}
              onCompleteSession={onCompleteSession}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
