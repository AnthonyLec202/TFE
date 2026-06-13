import { CalendarX, CheckCircle2, UserX } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { SessionStatus } from '../../../core/offline/LocalDatabase';

export interface SessionCompletionModalProps {
  sessionId: string;
  onSelect: (sessionId: string, status: SessionStatus) => void;
  onClose: () => void;
}

export function SessionCompletionModal({ sessionId, onSelect, onClose }: SessionCompletionModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <Card className="w-full max-w-sm p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-slate-900">Mark session as finished</h2>
          <p className="text-sm text-slate-500">How did this session go?</p>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            className="justify-start"
            onClick={() => onSelect(sessionId, SessionStatus.Completed)}
          >
            <CheckCircle2 className="h-4 w-4" />
            Présent
          </Button>
          <Button
            variant="secondary"
            className="justify-start"
            onClick={() => onSelect(sessionId, SessionStatus.PatientCancelled)}
          >
            <CalendarX className="h-4 w-4" />
            Annulée à l'avance
          </Button>
          <Button
            variant="danger"
            className="justify-start"
            onClick={() => onSelect(sessionId, SessionStatus.NoShow)}
          >
            <UserX className="h-4 w-4" />
            Absent
          </Button>
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}
