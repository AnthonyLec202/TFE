import { type FormEvent, useEffect, useState } from 'react';
import { ChevronRight, Loader2, Plus, UserPlus, UserRound, X } from 'lucide-react';
import { useAuth } from '../auth';
import { createPatient, getPatients } from '../../services/patientService';
import type { CreatePatientPayload, PatientResponse } from '../../types/patient';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const EMPTY_FORM: CreatePatientPayload = { firstName: '', lastName: '', birthDate: '' };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-BE', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

interface Props {
  onSelectPatient: (id: string) => void;
  onJoinPatient?: () => void;
}

export function DashboardContainer({ onSelectPatient, onJoinPatient }: Props) {
  const { user } = useAuth();

  const isAdmin = user?.roles.includes('Admin') ?? false;

  const [patients, setPatients] = useState<PatientResponse[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreatePatientPayload>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    getPatients()
      .then(setPatients)
      .catch(() => setListError('Impossible de charger la liste des patients.'))
      .finally(() => setLoadingList(false));
  }, []);

  function openModal() { setForm(EMPTY_FORM); setCreateError(''); setShowModal(true); }
  function closeModal() { setShowModal(false); }

  function setField(field: keyof CreatePatientPayload) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const created = await createPatient(form);
      setPatients(prev => [...prev, created].sort((a, b) => a.lastName.localeCompare(b.lastName)));
      closeModal();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {isAdmin ? 'Mes patients' : 'Patients suivis'}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {patients.length} patient{patients.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onJoinPatient && (
            <Button variant="secondary" onClick={onJoinPatient}>
              <UserPlus className="h-4 w-4" />
              Rejoindre un patient
            </Button>
          )}
          {isAdmin && (
            <Button onClick={openModal}>
              <Plus className="h-4 w-4" />
              Créer un patient
            </Button>
          )}
        </div>
      </div>

      {/* Patient list */}
      {loadingList ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : listError ? (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {listError}
        </p>
      ) : patients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
            <UserRound className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">Aucun patient pour le moment.</p>
          {isAdmin && (
            <Button variant="secondary" size="sm" onClick={openModal}>
              Créer le premier patient
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map(patient => (
            <button
              key={patient.id}
              onClick={() => onSelectPatient(patient.id)}
              className="group text-left bg-white rounded-xl border border-slate-200 px-5 py-4 hover:border-blue-300 hover:shadow-sm transition-all flex items-center justify-between gap-4"
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-medium text-slate-900 truncate">
                  {patient.lastName.toUpperCase()}, {patient.firstName}
                </span>
                <span className="text-sm text-slate-500">
                  Né(e) le {formatDate(patient.birthDate)}
                </span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-500 shrink-0 transition-colors" />
            </button>
          ))}
        </div>
      )}

      {/* Create patient modal (Admin only) */}
      {showModal && isAdmin && (
        <div
          className="fixed inset-0 bg-black/25 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Nouveau patient</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Fermer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Prénom" type="text" placeholder="Léa" value={form.firstName} onChange={setField('firstName')} required autoFocus />
                <Input label="Nom" type="text" placeholder="Martin" value={form.lastName} onChange={setField('lastName')} required />
              </div>
              <Input label="Date de naissance" type="date" value={form.birthDate} onChange={setField('birthDate')} required />
              {createError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{createError}</p>
              )}
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="secondary" className="flex-1" onClick={closeModal}>Annuler</Button>
                <Button type="submit" loading={creating} className="flex-1">Créer</Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
