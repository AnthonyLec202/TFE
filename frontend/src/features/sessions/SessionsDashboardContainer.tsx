import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getAllSessions, getAllLocalPatients, closeSessionLocally } from './services/localSessionService';
import type { LocalPatientSync, LocalSessionAttendance } from '../../core/offline/LocalDatabase';
import { runSyncCycle } from '../../core/offline/syncEngine';
import { useGlobalNetworkState } from '../../core/offline/NetworkStateProvider';
import { OfflinePill } from '../../components/ui/OfflinePill';
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

  // Consume the hoisted global reachability state for the header pill — consistent with the Patients
  // and Clinical Tools pages.
  const isOnline = useGlobalNetworkState();

  const [searchTerm, setSearchTerm] = useState('');
  const [timeframe, setTimeframe] = useState<SessionTimeframe>(loadStoredTimeframe);

  // Remember the last selected timeframe across remounts.
  useEffect(() => {
    localStorage.setItem(TIMEFRAME_STORAGE_KEY, timeframe);
  }, [timeframe]);

  // Close a session with its per-patient attendances, archiving it to the patients' history. The
  // live query reactively drops the card from this dashboard once the session is closed.
  async function handleCompleteSession(id: string, attendances: LocalSessionAttendance[]): Promise<void> {
    await closeSessionLocally(id, attendances);
    await runSyncCycle(); // push the closure to the server (no-op while offline)
  }

  const patientsById = useMemo(() => {
    const map = new Map<string, LocalPatientSync>();
    (patients ?? []).forEach(p => map.set(p.id, p));
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
          .map(id => {
            const patient = patientsById.get(id);
            return patient ? `${patient.firstName} ${patient.lastName}` : '';
          })
          .join(' ')
          .toLowerCase()
          .includes(query);
        return titleMatch || patientMatch;
      });

    // 2) Timeframe filter.
    if (timeframe === 'week') return byText.filter(session => isInWeekOf(session, now));
    if (timeframe === 'month') return byText.filter(session => isInMonthOf(session, now));
    return byText;
  }, [sessions, searchTerm, timeframe, patientsById]);

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif font-semibold text-[clamp(1.5rem,4.5vw,1.875rem)] tracking-[-0.015em] text-ink">Mes séances</h1>
        {!isOnline && <OfflinePill />}
      </div>

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
            patientsById={patientsById}
            isLoading={sessions === undefined}
            onCompleteSession={handleCompleteSession}
          />
        </div>
      </div>
    </div>
  );
}
