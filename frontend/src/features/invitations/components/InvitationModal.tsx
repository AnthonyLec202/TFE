import { useState } from 'react';
import { Check, ClipboardCopy, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { RELATIONSHIP_ROLES, type InvitationResponse } from '../../../types/patient';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (role: string) => Promise<void>;
  invitation: InvitationResponse | null;
  generating: boolean;
  error: string;
  copied: boolean;
  onCopy: () => void;
}

export function InvitationModal({
  isOpen, onClose, onGenerate, invitation, generating, error, copied, onCopy,
}: Props) {
  const [selectedRole, setSelectedRole] = useState('');

  async function handleGenerate() {
    if (!selectedRole) return;
    await onGenerate(selectedRole);
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/25 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget && !generating) onClose(); }}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-sm p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            Qui souhaitez-vous inviter ?
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!invitation ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Rôle</label>
              <select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="" disabled>Sélectionner un rôle…</option>
                {RELATIONSHIP_ROLES.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button onClick={handleGenerate} loading={generating} disabled={!selectedRole} className="w-full">
              Générer un code
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 text-center">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-6 flex flex-col gap-1">
              <p className="text-xs text-slate-400">Code d'invitation</p>
              <span className="text-3xl font-mono tracking-widest font-semibold text-slate-900">
                {invitation.plainSecretCode}
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Transmettez ce code. Il expire le{' '}
              <span className="font-medium text-slate-700">
                {new Date(invitation.expiresAt).toLocaleDateString('fr-BE', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })}
              </span>.
            </p>

            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={onCopy}>
                {copied
                  ? <><Check className="h-4 w-4 text-emerald-600" /> Copié</>
                  : <><ClipboardCopy className="h-4 w-4" /> Copier le code</>
                }
              </Button>
              <Button variant="secondary" className="flex-1" onClick={onClose}>Fermer</Button>
            </div>

            <p className="text-xs text-slate-400">Ce code ne sera plus affiché après fermeture.</p>
          </div>
        )}

      </div>
    </div>
  );
}
