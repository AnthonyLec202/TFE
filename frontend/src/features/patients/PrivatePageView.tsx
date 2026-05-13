import { useState } from 'react';
import { Check, ClipboardCopy } from 'lucide-react';
import { generateInvitation } from '../../services/patientService';
import type { InvitationResponse, PatientUserRole } from '../../types/patient';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

const ROLE_OPTIONS = [
  { value: 'Parent',               label: 'Parent' },
  { value: 'Teacher',              label: 'Enseignant(e)' },
  { value: 'SpeechTherapist',      label: 'Logopède' },
  { value: 'PsychomotorTherapist', label: 'Psychomotricien(ne)' },
  { value: 'Ergotherapist',        label: 'Ergothérapeute' },
  { value: 'Doctor',               label: 'Médecin' },
  { value: 'Other',                label: 'Autre' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-BE', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

interface Props {
  patientId: string;
  userRole: PatientUserRole;
}

export function PrivatePageView({ patientId, userRole }: Props) {
  const canInvite = userRole === 'Admin' || userRole === 'Parent';

  const [selectedRole, setSelectedRole] = useState('Parent');
  const [generating, setGenerating] = useState(false);
  const [invitation, setInvitation] = useState<InvitationResponse | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [copied, setCopied] = useState(false);

  async function handleGenerateInvitation() {
    setInviteError('');
    setInvitation(null);
    setGenerating(true);
    try {
      const result = await generateInvitation(patientId, selectedRole);
      setInvitation(result);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!invitation) return;
    await navigator.clipboard.writeText(invitation.plainSecretCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Publications placeholder */}
      <div className="flex items-center justify-center py-12 border border-dashed border-slate-200 rounded-xl">
        <p className="text-sm text-slate-400">Page privée : Publications (En construction)</p>
      </div>

      {/* Invitation section — visible to Admin and Parent only */}
      {canInvite && (
        <Card className="p-6 flex flex-col gap-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Inviter un collaborateur</h3>
            <p className="mt-1 text-sm text-slate-500">
              Générez un code d'invitation à usage unique pour ajouter un membre à l'équipe de soins.
            </p>
          </div>

          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex flex-col gap-1.5 flex-1 min-w-40">
              <label className="text-sm font-medium text-slate-700">Rôle</label>
              <select
                value={selectedRole}
                onChange={e => { setSelectedRole(e.target.value); setInvitation(null); }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {ROLE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <Button onClick={handleGenerateInvitation} loading={generating} variant="secondary">
              Générer un code
            </Button>
          </div>

          {inviteError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {inviteError}
            </p>
          )}

          {invitation && (
            <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-500">
                Transmettez ce code au collaborateur. Il expire le{' '}
                <span className="font-medium text-slate-700">{formatDate(invitation.expiresAt)}</span>.
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-center">
                  <span className="text-2xl font-mono tracking-widest font-semibold text-slate-900">
                    {invitation.plainSecretCode}
                  </span>
                </div>
                <Button variant="secondary" onClick={handleCopy} className="shrink-0 gap-1.5">
                  {copied
                    ? <><Check className="h-4 w-4 text-emerald-600" /> Copié</>
                    : <><ClipboardCopy className="h-4 w-4" /> Copier</>
                  }
                </Button>
              </div>
              <p className="text-xs text-slate-400 text-center">
                Ce code ne sera plus affiché après avoir quitté cette page.
              </p>
            </div>
          )}
        </Card>
      )}

    </div>
  );
}
