import { Loader2, Trash2, UserRound, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import type { CareTeamMemberResponse } from '../../../types/patient';

export interface CareTeamModalProps {
  isOpen: boolean;
  members: CareTeamMemberResponse[];
  loading: boolean;
  error: string;
  /** Whether the current user may remove members (renders a Remove button per removable member). */
  isAdmin: boolean;
  /** Id of the member whose removal is in flight, used to show a per-row spinner. */
  removingUserId: string | null;
  onRemove: (userId: string) => void;
  onClose: () => void;
}

export function CareTeamModal({
  isOpen, members, loading, error, isAdmin, removingUserId, onRemove, onClose,
}: CareTeamModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/25 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Membres de l'équipe</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        ) : members.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Aucun membre dans l'équipe.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {members.map(member => {
              // The administrator anchors the record and is never removable.
              const isRemovable = isAdmin && member.role !== 'Admin';
              const isRemoving = removingUserId === member.userId;
              return (
                <li
                  key={member.userId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                      <UserRound className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-slate-800 truncate">
                        {member.lastName.toUpperCase()}, {member.firstName}
                      </span>
                      <span className="text-xs text-slate-500 truncate">{member.relationship}</span>
                    </div>
                  </div>

                  {isRemovable && (
                    <Button
                      variant="danger"
                      size="sm"
                      loading={isRemoving}
                      onClick={() => onRemove(member.userId)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Retirer
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
