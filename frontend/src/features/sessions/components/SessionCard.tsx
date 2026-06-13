import { useState } from 'react';
import { Calendar, CheckCircle2, Clock, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import type { LocalSession, SessionStatus } from '../../../core/offline/LocalDatabase';
import type { SessionDetailOrigin } from '../../../types/navigation';
import { formatSessionDate, formatPatientNames } from '../utils/sessionFormatters';
import { SessionCompletionModal } from './SessionCompletionModal';

export interface SessionCardProps {
  session: LocalSession;
  patientNamesById: Map<string, string>;
  /** Persists the selected attendance status, archiving the session to the patient's history. */
  onCompleteSession: (sessionId: string, status: SessionStatus) => void;
}

export function SessionCard({ session, patientNamesById, onCompleteSession }: SessionCardProps) {
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);

  function handleSelectStatus(sessionId: string, status: SessionStatus): void {
    setIsCompletionModalOpen(false);
    onCompleteSession(sessionId, status);
  }

  return (
    <>
      <Link
        to={`/sessions/${session.id}`}
        state={{ from: '/sessions', label: 'My Sessions' } satisfies SessionDetailOrigin}
        className="block group"
      >
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
              {formatSessionDate(session.date)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {session.time}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {formatPatientNames(session.patientIds, patientNamesById)}
            </span>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={e => {
                // Suppress the parent Link navigation; this action stays on the dashboard.
                e.preventDefault();
                e.stopPropagation();
                setIsCompletionModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50 transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Séance terminée
            </button>
          </div>
        </Card>
      </Link>

      {isCompletionModalOpen && (
        <SessionCompletionModal
          sessionId={session.id}
          onSelect={handleSelectStatus}
          onClose={() => setIsCompletionModalOpen(false)}
        />
      )}
    </>
  );
}
