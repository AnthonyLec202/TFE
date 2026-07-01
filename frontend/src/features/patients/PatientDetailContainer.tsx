import { useEffect, useState, type SubmitEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { ArrowLeft, Loader2, LogOut, Pencil, Trash2, TriangleAlert, UserPlus, UserRound, Users, X } from 'lucide-react';
import { deletePatient, getPatient, removeCareTeamMember, updatePatient } from '../../services/patientService';
import { HttpError } from '../../services/apiClient';
import { getPatientTerminology } from './utils/patientTerminology';
import { removeLocalPatient } from './services/localPatientService';
import type { PatientResponse, UpdatePatientPayload } from '../../types/patient';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { MaskedDateInput } from '../../components/ui/MaskedDateInput';
import { SessionHistoryContainer } from './SessionHistoryContainer';
import { CareTeamContainer } from './CareTeamContainer';
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
  // The modal edits the dossier fields only; the archived flag is preserved separately on submit so a
  // routine edit never accidentally un-archives the patient.
  const [editForm, setEditForm] = useState<Omit<UpdatePatientPayload, 'isArchived'>>({
    firstName: '', lastName: '', birthDate: '', email: '', phoneNumber: '', postalAddress: '',
  });
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState('');

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);

  useEffect(() => {
    getPatient(patientId)
      .then(p => { setPatient(p); })
      .catch(err => {
        // A notification can deep-link to a dossier that has since been archived (403, read-restricted
        // for non-managers) or deleted (404). Surface a single, non-revealing message in both cases
        // rather than the generic load error, so a stale notification link degrades gracefully without
        // disclosing whether the record still exists.
        if (err instanceof HttpError && (err.status === 403 || err.status === 404)) {
          setError('Impossible de charger ce dossier. Le patient a été archivé ou supprimé par le gestionnaire.');
        } else {
          setError('Impossible de charger ce patient.');
        }
      })
      .finally(() => setLoading(false));
  }, [patientId]);

  function openEdit() {
    if (!patient) return;
    setEditForm({
      firstName: patient.firstName,
      lastName: patient.lastName,
      birthDate: toDateInput(patient.birthDate),
      email: patient.email ?? '',
      phoneNumber: patient.phoneNumber ?? '',
      postalAddress: patient.postalAddress ?? '',
    });
    setUpdateError('');
    setShowEdit(true);
  }

  async function handleUpdate(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setUpdateError('');
    setUpdating(true);
    try {
      // Optional contact fields are nullified when blank: an empty string would otherwise fail the
      // server's [EmailAddress] validation (which treats "" as an invalid address) and 400 the whole
      // update. Trim so a whitespace-only entry is also treated as "no value".
      const blankToNull = (value?: string | null): string | null => {
        const trimmed = (value ?? '').trim();
        return trimmed.length > 0 ? trimmed : null;
      };
      const payload: UpdatePatientPayload = {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        birthDate: editForm.birthDate,
        email: blankToNull(editForm.email),
        phoneNumber: blankToNull(editForm.phoneNumber),
        postalAddress: blankToNull(editForm.postalAddress),
        isArchived: patient?.isArchived ?? false, // preserve the current archive state
      };
      const updated = await updatePatient(patientId, payload);
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

  async function handleLeaveTeam() {
    if (!user) return;
    setLeaveError('');
    setLeaving(true);
    try {
      await removeCareTeamMember(patientId, user.userId);
      // Clear the local patient cache so this record no longer appears in the autocomplete.
      await removeLocalPatient(patientId);
      onNavigateBack();
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : 'Une erreur est survenue.');
      setLeaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-taupe-400" />
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="flex flex-col gap-4">
        <button
          onClick={onNavigateBack}
          className="inline-flex items-center gap-1.5 text-sm text-taupe-500 hover:text-ink w-fit"
        >
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error || 'Patient introuvable.'}
        </p>
      </div>
    );
  }

  // RBAC: an archived dossier is reachable only by the managing psychologist (Admin for this patient).
  // Any other role (parent, teacher/collaborator, …) is redirected to the root — a client-side mirror
  // of the backend's 403 guard, so a stale link or manual URL never renders archived content.
  if (patient.isArchived && patient.userRole !== 'Admin') {
    return <Navigate to="/" replace />;
  }

  const isAdmin = user?.roles?.includes('Admin') ?? false;
  const isParent = patient.userRole === 'Parent';
  const canInvite = isAdmin || isParent;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">

      {/* Back */}
      <button
        onClick={onNavigateBack}
        className="inline-flex items-center gap-1.5 text-sm text-taupe-500 hover:text-ink w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        {/* Derive the label from the loaded patient (not location.state) so a hard reload of the
            dossier still points back to the correct list. Archived dossiers are Admin-only, so the
            "Mes archives" branch implies a psychologist; otherwise the role-based terminology decides
            between "Mes patients" (psychologist) and "Mes dossiers" (collaborator). */}
        {patient.isArchived ? 'Mes archives' : getPatientTerminology(isAdmin).back_label_patients}
      </button>

      {/* Identity card */}
      <Card className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-full bg-petrol-50 flex items-center justify-center shrink-0">
            <UserRound className="h-6 w-6 text-petrol-600" />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <h2 className="text-xl font-semibold text-ink break-words">
              {patient.lastName.toUpperCase()}, {patient.firstName}
            </h2>
            <p className="text-sm text-taupe-500">
              Né(e) le {formatDate(patient.birthDate)} · {calculateAge(patient.birthDate)} ans
            </p>
          </div>
        </div>

        {/* Header actions */}
        <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
          <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowTeamModal(true)}>
              <Users className="h-3.5 w-3.5" />
              Voir membres
            </Button>
            {canInvite && (
              <Button variant="ghost" size="sm" onClick={() => setShowInviteModal(true)}>
                <UserPlus className="h-3.5 w-3.5" />
                Inviter
              </Button>
            )}
            {isAdmin ? (
              <>
                <Button variant="ghost" size="sm" onClick={openEdit}>
                  <Pencil className="h-3.5 w-3.5" />
                  Modifier
                </Button>
                <Button variant="dangerGhost" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => { setLeaveError(''); setShowLeaveConfirm(true); }}>
                <LogOut className="h-3.5 w-3.5" />
                Quitter
              </Button>
            )}
          </div>
          {leaveError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
              {leaveError}
            </p>
          )}
        </div>
      </Card>

      {/* Content — tabbed for Admin, direct for others */}
      {isAdmin ? (
        <div className="flex flex-col">
          <div className="flex border-b border-sand-200">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={[
                  'px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                  activeTab === tab
                    ? 'border-petrol-600 text-petrol-600'
                    : 'border-transparent text-taupe-500 hover:text-ink hover:border-sand-300',
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
            {activeTab === 'Page Privée' && <CollaborativeWallContainer patientId={patient.id} userRole={patient.userRole} isArchived={patient.isArchived} />}
          </div>
        </div>
      ) : (
        <CollaborativeWallContainer patientId={patient.id} userRole={patient.userRole} isArchived={patient.isArchived} />
      )}

      {/* ── Edit modal ──────────────────────────────────────────────────────── */}
      {showEdit && (
        <div
          className="fixed inset-0 bg-black/25 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowEdit(false); }}
        >
          <div className="bg-white rounded-2xl border border-sand-200 shadow-xl w-full max-w-md p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-ink">Modifier le dossier</h3>
              <button onClick={() => setShowEdit(false)} className="text-taupe-400 hover:text-ink" aria-label="Fermer">
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
              <MaskedDateInput
                label="Date de naissance"
                value={editForm.birthDate}
                onChange={value => setEditForm(p => ({ ...p, birthDate: value }))}
                placeholder="jj / mm / aaaa"
                required
              />
              <Input
                label="E-mail"
                type="email"
                value={editForm.email ?? ''}
                onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                placeholder="prenom.nom@exemple.com"
                autoComplete="off"
              />
              <Input
                label="Téléphone"
                type="tel"
                value={editForm.phoneNumber ?? ''}
                onChange={e => setEditForm(p => ({ ...p, phoneNumber: e.target.value }))}
                placeholder="+32 470 12 34 56"
                autoComplete="off"
              />
              <Input
                label="Adresse postale"
                type="text"
                value={editForm.postalAddress ?? ''}
                onChange={e => setEditForm(p => ({ ...p, postalAddress: e.target.value }))}
                placeholder="Rue, numéro, code postal, ville"
                autoComplete="off"
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
          <div className="bg-white rounded-2xl border border-sand-200 shadow-xl w-full max-w-sm p-6 flex flex-col gap-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <TriangleAlert className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-ink">Supprimer le dossier ?</h3>
                <p className="mt-1 text-sm text-taupe-500">
                  Cette action est irréversible. Le dossier de{' '}
                  <span className="font-medium text-ink">
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

      {/* ── Leave confirmation modal ─────────────────────────────────────── */}
      {showLeaveConfirm && (
        <div
          className="fixed inset-0 bg-black/25 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget && !leaving) setShowLeaveConfirm(false); }}
        >
          <div className="bg-white rounded-2xl border border-sand-200 shadow-xl w-full max-w-sm p-6 flex flex-col gap-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
                <LogOut className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-ink">Quitter l'équipe ?</h3>
                <p className="mt-1 text-sm text-taupe-500">
                  Vous n'aurez plus accès au dossier de{' '}
                  <span className="font-medium text-ink">
                    {patient.firstName} {patient.lastName}
                  </span>
                  .
                </p>
              </div>
            </div>

            {leaveError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
                {leaveError}
              </p>
            )}

            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowLeaveConfirm(false)}
                disabled={leaving}
              >
                Annuler
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                loading={leaving}
                onClick={handleLeaveTeam}
              >
                Quitter
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

      {/* ── Care team modal ──────────────────────────────────────────────── */}
      <CareTeamContainer
        patientId={patient.id}
        isAdmin={isAdmin}
        isOpen={showTeamModal}
        onClose={() => setShowTeamModal(false)}
      />

    </div>
  );
}
