import { useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { SessionStatus } from '../../../core/offline/LocalDatabase';
import type { LocalPatientSync, LocalSession, LocalSessionAttendance } from '../../../core/offline/LocalDatabase';
import type { SessionDetailOrigin } from '../../../types/navigation';
import { formatSessionDate } from '../utils/sessionFormatters';

export interface SessionCardProps {
  session: LocalSession;
  /** Lookup of every locally-known patient by id, used to label each attendance chip. */
  patientsById: Map<string, LocalPatientSync>;
  /** Closes the session with the per-patient attendances, archiving it to the patients' history. */
  onCompleteSession: (sessionId: string, attendances: LocalSessionAttendance[]) => void;
}

// Click-cycle order for a patient chip: Unset → Completed → NoShow → PatientCancelled → (loop).
const ATTENDANCE_CYCLE: SessionStatus[] = [
  SessionStatus.Completed,
  SessionStatus.NoShow,
  SessionStatus.PatientCancelled,
];

function nextStatus(current: SessionStatus | undefined): SessionStatus {
  if (current === undefined) return ATTENDANCE_CYCLE[0];
  const index = ATTENDANCE_CYCLE.indexOf(current);
  return ATTENDANCE_CYCLE[(index + 1) % ATTENDANCE_CYCLE.length];
}

function chipClasses(status: SessionStatus | undefined): string {
  switch (status) {
    case SessionStatus.Completed:
      return 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100';
    case SessionStatus.NoShow:
      return 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100';
    case SessionStatus.PatientCancelled:
      return 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100';
    default:
      return 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100';
  }
}

function statusLabel(status: SessionStatus | undefined): string {
  switch (status) {
    case SessionStatus.Completed:
      return 'Présent';
    case SessionStatus.NoShow:
      return 'Absent';
    case SessionStatus.PatientCancelled:
      return 'Annulé';
    default:
      return 'À définir';
  }
}

export function SessionCard({ session, patientsById, onCompleteSession }: SessionCardProps) {
  // Deduplicate participants so each patient maps to exactly one chip, one dictionary entry, and one
  // React key — guarding against any cross-chip "applies to all" behaviour from duplicate ids.
  const participantIds = useMemo(() => Array.from(new Set(session.patientIds)), [session.patientIds]);

  // Per-patient attendance selection (patientId → status), local to the card until it is closed.
  const [attendanceByPatient, setAttendanceByPatient] = useState<Record<string, SessionStatus | undefined>>({});

  function cyclePatientStatus(patientId: string): void {
    // Immutable, per-key update: spread the previous map and overwrite only the clicked patientId,
    // leaving every other patient's selection untouched.
    setAttendanceByPatient(previous => ({
      ...previous,
      [patientId]: nextStatus(previous[patientId]),
    }));
  }

  // The session may only be closed once every participating patient has a defined attendance.
  const allPatientsRated =
    participantIds.length > 0 && participantIds.every(id => attendanceByPatient[id] !== undefined);

  function handleFinish(): void {
    const attendances: LocalSessionAttendance[] = participantIds.map(id => ({
      patientId: id,
      status: attendanceByPatient[id]!,
    }));
    onCompleteSession(session.id, attendances);
  }

  return (
    <Link
      to={`/sessions/${session.id}`}
      state={{ from: '/sessions', label: 'My Sessions' } satisfies SessionDetailOrigin}
      className="block group"
    >
      <Card className="p-4 flex flex-col gap-3 group-hover:border-blue-200 group-hover:shadow-sm transition-shadow">
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
            {formatSessionDate(session.date)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {session.time}
          </span>
        </div>

        {/* Interactive attendance chips, one per participating patient. */}
        <div className="flex flex-wrap gap-2">
          {participantIds.map(patientId => {
            const status = attendanceByPatient[patientId];
            const patient = patientsById.get(patientId);
            const patientName = patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown';
            return (
              <button
                key={patientId}
                type="button"
                onClick={e => {
                  // Suppress the parent Link navigation; toggling stays on the dashboard.
                  e.preventDefault();
                  e.stopPropagation();
                  cyclePatientStatus(patientId);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${chipClasses(status)}`}
              >
                <span>{patientName}</span>
                <span className="opacity-70">· {statusLabel(status)}</span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={!allPatientsRated}
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              handleFinish();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Terminer la séance
          </button>
        </div>
      </Card>
    </Link>
  );
}
