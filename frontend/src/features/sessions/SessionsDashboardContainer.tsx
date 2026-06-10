import { useLiveQuery } from 'dexie-react-hooks';
import { getAllSessions } from './services/localSessionService';
import { CreateSessionContainer } from './CreateSessionContainer';
import { SessionsDashboard } from './components/SessionsDashboard';

export function SessionsDashboardContainer() {
  const sessions = useLiveQuery(() => getAllSessions());

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">My Sessions</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <CreateSessionContainer />
        </div>

        <div className="lg:col-span-2 flex flex-col gap-3">
          <SessionsDashboard sessions={sessions} />
        </div>
      </div>
    </div>
  );
}
