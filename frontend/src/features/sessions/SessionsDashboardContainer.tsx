import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getAllSessions, getAllLocalPatients, setSessionStatusLocally } from './services/localSessionService';
import type { SessionStatus } from '../../core/offline/LocalDatabase';
import { runSyncCycle } from '../../core/offline/syncEngine';
import {
  groupSessionsByWeek, groupSessionsByMonth,
  formatWeekRangeLabel, formatMonthLabel,
  isInWeekOf, isInMonthOf,
} from './utils/sessionDateUtils';
import { CreateSessionContainer } from './CreateSessionContainer';
import { SessionsDashboard, type SessionGroup } from './components/SessionsDashboard';
import { SessionFilters, type SessionTimeframe } from './components/SessionFilters';

// Persist the timeframe filter so it survives navigation away from and back to the dashboard.
const TIMEFRAME_STORAGE_KEY = 'sessions.timeframe';

function loadStoredTimeframe(): SessionTimeframe {
  const stored = localStorage.getItem(TIMEFRAME_STORAGE_KEY);
  return stored === 'week' || stored === 'month' || stored === 'all' ? stored : 'week';
}

export function SessionsDashboardContainer() {
  const sessions = useLiveQuery(() => getAllSessions());
  const patients = useLiveQuery(() => getAllLocalPatients());

  const [searchTerm, setSearchTerm] = useState('');
  const [timeframe, setTimeframe] = useState<SessionTimeframe>(loadStoredTimeframe);

  // Remember the last selected timeframe across remounts.
  useEffect(() => {
    localStorage.setItem(TIMEFRAME_STORAGE_KEY, timeframe);
  }, [timeframe]);

  // Archive a session to the patient's history with the selected attendance status. The live
  // query reactively drops the card from this dashboard once status moves off Scheduled.
  async function handleCompleteSession(id: string, status: SessionStatus): Promise<void> {
    await setSessionStatusLocally(id, status);
    await runSyncCycle(); // push the completion to the server (no-op while offline)
  }

  const patientNamesById = useMemo(() => {
    const map = new Map<string, string>();
    (patients ?? []).forEach(p => map.set(p.id, `${p.firstName} ${p.lastName}`));
    return map;
  }, [patients]);

  // Sequential filtering: text match, then timeframe restriction.
  const filteredSessions = useMemo(() => {
    const all = sessions ?? [];
    const query = searchTerm.trim().toLowerCase();
    const now = new Date();

    // 1) Text filter — match against the title or any associated patient's name.
    const byText = query.length === 0
      ? all
      : all.filter(session => {
        const titleMatch = session.title.toLowerCase().includes(query);
        const patientMatch = session.patientIds
          .map(id => patientNamesById.get(id) ?? '')
          .join(' ')
          .toLowerCase()
          .includes(query);
        return titleMatch || patientMatch;
      });

    // 2) Timeframe filter.
    if (timeframe === 'week') return byText.filter(session => isInWeekOf(session, now));
    if (timeframe === 'month') return byText.filter(session => isInMonthOf(session, now));
    return byText;
  }, [sessions, searchTerm, timeframe, patientNamesById]);

  // 3) Grouping — by week for the weekly view, by calendar month otherwise.
  const groups: SessionGroup[] = useMemo(() => {
    if (timeframe === 'week') {
      return groupSessionsByWeek(filteredSessions).map(group => ({
        key: group.key,
        label: formatWeekRangeLabel(group),
        sessions: group.sessions,
      }));
    }
    return groupSessionsByMonth(filteredSessions).map(group => ({
      key: group.key,
      label: formatMonthLabel(group),
      sessions: group.sessions,
    }));
  }, [filteredSessions, timeframe]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">My Sessions</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <CreateSessionContainer />
        </div>

        <div className="lg:col-span-2 flex flex-col gap-4">
          <SessionFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
          />
          <SessionsDashboard
            groups={groups}
            patientNamesById={patientNamesById}
            isLoading={sessions === undefined}
            onCompleteSession={handleCompleteSession}
          />
        </div>
      </div>
    </div>
  );
}
