import { Card } from '../../../components/ui/Card';
import type { LocalPatientSync, LocalSession, LocalSessionAttendance } from '../../../core/offline/LocalDatabase';
import { SessionCard } from './SessionCard';

export interface SessionGroup {
  key: string;
  label: string;
  sessions: LocalSession[];
}

export interface SessionsDashboardProps {
  groups: SessionGroup[];
  patientsById: Map<string, LocalPatientSync>;
  isLoading: boolean;
  /** Closes the session with the per-patient attendances, archiving it to the patients' history. */
  onCompleteSession: (id: string, attendances: LocalSessionAttendance[]) => void;
}

export function SessionsDashboard({ groups, patientsById, isLoading, onCompleteSession }: SessionsDashboardProps) {
  if (isLoading) {
    return <p className="text-sm text-taupe-400">Chargement des séances…</p>;
  }

  if (groups.length === 0) {
    return (
      <Card className="p-8 flex items-center justify-center">
        <p className="text-sm text-taupe-400">Aucune séance ne correspond aux filtres.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map(group => (
        <section key={group.key} className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-taupe-400">
            {group.label}
          </h2>

          {group.sessions.map(session => (
            <SessionCard
              key={session.id}
              session={session}
              patientsById={patientsById}
              onCompleteSession={onCompleteSession}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
