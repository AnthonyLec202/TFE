import { useEffect, useState, type SubmitEvent } from 'react';
import { useAuth } from '../auth';
import { ArrowLeft, Loader2, Pencil, Trash2, TriangleAlert, UserPlus, UserRound, X } from 'lucide-react';
import { deletePatient, getPatient, updatePatient } from '../../services/patientService';
import { removeLocalPatient } from './services/localPatientService';
import type { PatientResponse, UpdatePatientPayload } from '../../types/patient';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { SessionHistoryContainer } from './SessionHistoryContainer';
import { CollaborativeWallContainer } from '../collaborativeWall';
import { InvitationContainer } from '../invitations';

type Tab = 'Historique' | 'Page Privée';
const TABS: Tab[] = ['Historique', 'Page Privée'];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-BE', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

function calculateAge(iso: string): number {
  const today = new Date();
  const birth = new Date(iso);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function toDateInput(iso: string) {
  return iso.slice(0, 10);
}

interface Props {
  patientId: string;
  onNavigateBack: () => void;
}

export function PatientDetailContainer({ patientId, onNavigateBack }: Props) {
  const { user } = useAuth();
  const [patient, setPatient] = useState<PatientResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('Page Privée');

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<UpdatePatientPayload>({ firstName: '', lastName: '', birthDate: '' });
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    getPatient(patientId)
      .then(p => { setPatient(p); })
      .catch(() => setError('Impossible de charger ce patient.'))
      .finally(() => setLoading(false));
  }, [patientId]);

  function openEdit() {
    if (!patient) return;
    setEditForm({ firstName: patient.firstName, lastName: patient.lastName, birthDate: toDateInput(patient.birthDate) });
    setUpdateError('');
    setShowEdit(true);
  }

  async function handleUpdate(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setUpdateError('');
    setUpdating(true);
    try {
      const updated = await updatePatient(patientId, editForm);
      setPatient(updated);
      setShowEdit(false);
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete() {
    setDeleteError('');
    setDeleting(true);
    try {
      await deletePatient(patientId);
      // Prune the local search cache so the patient vanishes from the autocomplete immediately,
      // not only after the next full server sync (F5).
      await removeLocalPatient(patientId);
      onNavigateBack();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Une erreur est survenue.');
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="flex flex-col gap-4">
        <button
          onClick={onNavigateBack}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 w-fit"
        >
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error || 'Patient introuvable.'}
        </p>
      </div>
    );
  }

  const isAdmin = user?.roles?.includes('Admin') ?? false;
  const isParent = patient.userRole === 'Parent';
  const canInvite = isAdmin || isParent;

  return (
    <div className="flex flex-col gap-6 max-w-2xl">

      {/* Back */}
      <button
        onClick={onNavigateBack}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        {isAdmin ? 'Mes patients' : 'Patients suivis'}
      </button>

      {/* Identity card */}
      <Card className="p-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <UserRound className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <h2 className="text-xl font-semibold text-slate-900 truncate">
              {patient.lastName.toUpperCase()}, {patient.firstName}
            </h2>
            <p className="text-sm text-slate-500">
              Né(e) le {formatDate(patient.birthDate)} · {calculateAge(patient.birthDate)} ans
            </p>
          </div>
        </div>

        {/* Header actions */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {canInvite && (
            <Button variant="secondary" size="sm" onClick={() => setShowInviteModal(true)}>
              <UserPlus className="h-3.5 w-3.5" />
              Inviter
            </Button>
          )}
          {isAdmin && (
            <>
            <Button variant="secondary" size="sm" onClick={openEdit}>
              <Pencil className="h-3.5 w-3.5" />
              Modifier
            </Button>
            <Button variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </Button>
            </>
          )}
        </div>
      </Card>

      {/* Content — tabbed for Admin, direct for others */}
      {isAdmin ? (
        <div className="flex flex-col">
          <div className="flex border-b border-slate-200">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={[
                  'px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
                ].join(' ')}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="pt-6">
            {activeTab === 'Historique' && (
              <SessionHistoryContainer
                patientId={patientId}
                patientName={`${patient.firstName} ${patient.lastName}`}
              />
            )}
            {activeTab === 'Page Privée' && <CollaborativeWallContainer patientId={patient.id} userRole={patient.userRole} />}
          </div>
        </div>
      ) : (
        <CollaborativeWallContainer patientId={patient.id} userRole={patient.userRole} />
      )}

      {/* ── Edit modal ──────────────────────────────────────────────────────── */}
      {showEdit && (
        <div
          className="fixed inset-0 bg-black/25 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowEdit(false); }}
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Modifier le dossier</h3>
              <button onClick={() => setShowEdit(false)} className="text-slate-400 hover:text-slate-600" aria-label="Fermer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Prénom"
                  type="text"
                  value={editForm.firstName}
                  onChange={e => setEditForm(p => ({ ...p, firstName: e.target.value }))}
                  required
                  autoFocus
                />
                <Input
                  label="Nom"
                  type="text"
                  value={editForm.lastName}
                  onChange={e => setEditForm(p => ({ ...p, lastName: e.target.value }))}
                  required
                />
              </div>
              <Input
                label="Date de naissance"
                type="date"
                value={editForm.birthDate}
                onChange={e => setEditForm(p => ({ ...p, birthDate: e.target.value }))}
                required
              />
              {updateError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {updateError}
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowEdit(false)}>
                  Annuler
                </Button>
                <Button type="submit" loading={updating} className="flex-1">
                  Enregistrer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ─────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/25 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget && !deleting) setShowDeleteConfirm(false); }}
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-sm p-6 flex flex-col gap-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <TriangleAlert className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Supprimer le dossier ?</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Cette action est irréversible. Le dossier de{' '}
                  <span className="font-medium text-slate-700">
                    {patient.firstName} {patient.lastName}
                  </span>{' '}
                  et toutes ses données associées seront définitivement supprimés.
                </p>
              </div>
            </div>

            {deleteError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
                {deleteError}
              </p>
            )}

            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Annuler
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                loading={deleting}
                onClick={handleDelete}
              >
                Supprimer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invitation modal ─────────────────────────────────────────────── */}
      <InvitationContainer
        isOpen={showInviteModal}
        patientId={patient.id}
        onClose={() => setShowInviteModal(false)}
      />

    </div>
  );
}
