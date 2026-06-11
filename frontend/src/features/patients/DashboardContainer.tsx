import { useCallback, useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../auth';
import { getPatients } from '../../services/patientService';
import type { CreatePatientPayload, PatientResponse } from '../../types/patient';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CreatePatientForm } from './components/CreatePatientForm';
import { PatientsList } from './components/PatientsList';
import { createPatientWithOfflineFallback, onOfflinePatientsSynced, syncOfflinePatientQueue } from './services/offlinePatientQueueService';

// The id is generated at submission, so the editable form state omits it.
type PatientFormState = Omit<CreatePatientPayload, 'id'>;
const EMPTY_FORM: PatientFormState = { firstName: '', lastName: '', birthDate: '' };

interface Props {
  onSelectPatient: (id: string) => void;
  onJoinPatient?: () => void;
}

export function DashboardContainer({ onSelectPatient, onJoinPatient }: Props) {
  const { user, isInitialized } = useAuth();
  const isAdmin = user?.roles.includes('Admin') ?? false;

  const [patients, setPatients] = useState<PatientResponse[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState('');

  const [form, setForm] = useState<PatientFormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [offlineNotice, setOfflineNotice] = useState('');

  // Stable across renders (no deps) so the subscription effect below mounts exactly once.
  const loadPatients = useCallback(() => {
    setLoadingList(true);
    setListError('');
    return getPatients()
      .then(setPatients)
      .catch(() => setListError('Impossible de charger la liste des patients.'))
      .finally(() => setLoadingList(false));
  }, []);

  // Wait for auth to be initialized (token restored AND applied to the API client) before the
  // first fetch, otherwise the GET races ahead of the token on a fresh page load and 401s.
  useEffect(() => {
    if (!isInitialized) return;
    loadPatients();
  }, [isInitialized, loadPatients]);

  // When the offline queue drains, refetch so newly synced patients appear without a remount.
  // The listener only fires after a successful drain (a finite event), and refetching issues a
  // GET that never triggers another drain — so there is no render/sync loop.
  useEffect(() => onOfflinePatientsSynced(loadPatients), [loadPatients]);

  // Manual reconnection trigger. The browser never lost its network interface during a backend
  // outage, so window 'online' never fired and the queue stayed stuck. Retry must therefore
  // PUSH first — drain any pending offline patients to the now-awake backend — then PULL the
  // fresh list. The drain is awaited so the reload reflects the just-synced records.
  const handleRetry = useCallback(async () => {
    await syncOfflinePatientQueue();
    await loadPatients();
  }, [loadPatients]);

  async function handleCreate() {
    setCreateError('');
    setOfflineNotice('');
    setCreating(true);
    try {
      // Generate the patient id up front so the record is linkable (e.g. to a session)
      // even while it is still pending in the offline queue.
      const payload: CreatePatientPayload = { id: crypto.randomUUID(), ...form };

      // Local-first fallback: try the server; if it is unreachable, the payload is queued
      // offline rather than lost. A genuine API error (validation, etc.) is rethrown below.
      const outcome = await createPatientWithOfflineFallback(payload);
      if (outcome.status === 'created') {
        setPatients(prev => [...prev, outcome.patient].sort((a, b) => a.lastName.localeCompare(b.lastName)));
      } else {
        setOfflineNotice('Patient enregistré hors ligne. Il sera synchronisé au retour de la connexion.');
      }
      setForm(EMPTY_FORM);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {isAdmin ? 'Mes patients' : 'Patients suivis'}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {patients.length} patient{patients.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          {isAdmin ? (
            <CreatePatientForm
              firstName={form.firstName}
              lastName={form.lastName}
              birthDate={form.birthDate}
              submitting={creating}
              error={createError}
              info={offlineNotice}
              onFirstNameChange={value => setForm(prev => ({ ...prev, firstName: value }))}
              onLastNameChange={value => setForm(prev => ({ ...prev, lastName: value }))}
              onBirthDateChange={value => setForm(prev => ({ ...prev, birthDate: value }))}
              onSubmit={handleCreate}
            />
          ) : onJoinPatient ? (
            <Card className="p-5 flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-slate-700">Rejoindre un patient</h2>
              <p className="text-xs text-slate-500">
                Utilisez un code d'invitation pour accéder au suivi d'un patient.
              </p>
              <Button variant="secondary" size="sm" onClick={onJoinPatient} className="w-full">
                <UserPlus className="h-4 w-4" />
                Rejoindre un patient
              </Button>
            </Card>
          ) : null}
        </div>

        <div className="lg:col-span-2">
          <PatientsList
            patients={patients}
            isLoading={loadingList}
            error={listError}
            onSelectPatient={onSelectPatient}
            onRetry={handleRetry}
          />
        </div>
      </div>
    </div>
  );
}
