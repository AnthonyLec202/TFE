import { useCallback, useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../auth';
import { getPatients } from '../../services/patientService';
import type { CreatePatientPayload, PatientResponse } from '../../types/patient';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CreatePatientForm } from './components/CreatePatientForm';
import { PatientsList } from './components/PatientsList';
import { createPatientWithOfflineFallback, onOfflinePatientsSynced } from './services/offlinePatientQueueService';
import { syncPatientsFromServer } from './services/localPatientService';
import { runSyncCycle } from '../../core/offline/syncEngine';

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

  // Reconnection sequence: PUSH, then refresh local caches, then PULL.
  //  1) runSyncCycle — global orchestrator: pushes pending patients first, then pending sessions,
  //     reconciling the local store against the (now-awake) backend.
  //  2) syncPatientsFromServer — refresh the Dexie patient cache (db.patients). The session cards
  //     on /sessions resolve patient names from this cache via useLiveQuery, so without this they
  //     keep showing "1 patient" for a just-synced offline patient until a full F5. Repopulating
  //     the cache lets those reactive cards bind the real name automatically.
  //  3) loadPatients — refresh the patient-list React state shown on this dashboard.
  // All awaited so the UI never reflects a half-reconciled state.
  const reconnectAndLoad = useCallback(async () => {
    setLoadingList(true);
    setListError('');
    try {
      await runSyncCycle();
      await syncPatientsFromServer();
      await loadPatients();
    } catch {
      // Backend unreachable during any step (e.g. syncPatientsFromServer rejects before
      // loadPatients runs): surface the error UI so the Réessayer button renders.
      setListError('Impossible de charger la liste des patients.');
    } finally {
      // Always clear the spinner, otherwise a thrown step leaves it stuck indefinitely.
      setLoadingList(false);
    }
  }, [loadPatients]);

  // Wait for auth to be initialized (token restored AND applied to the API client) before the
  // first fetch, otherwise the GET races ahead of the token on a fresh page load and 401s.
  // MainLayout stays mounted across navigation, so this remount is the only trigger when returning
  // to the dashboard — flush the offline queue here before pulling, otherwise the list would show
  // stale server data and miss patients created offline while the backend was down.
  useEffect(() => {
    if (!isInitialized) return;
    reconnectAndLoad();
  }, [isInitialized, reconnectAndLoad]);

  // When the offline queue drains elsewhere, refetch so newly synced patients appear without a
  // remount. The listener only fires after a successful drain (a finite event), and refetching
  // issues a GET that never triggers another drain — so there is no render/sync loop.
  useEffect(() => onOfflinePatientsSynced(loadPatients), [loadPatients]);

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
            onRetry={reconnectAndLoad}
          />
        </div>
      </div>
    </div>
  );
}
