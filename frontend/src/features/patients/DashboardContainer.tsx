import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { RotateCw, UserPlus } from 'lucide-react';
import { useAuth } from '../auth';
import type { CreatePatientPayload } from '../../types/patient';
import { db } from '../../core/offline/LocalDatabase';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CreatePatientForm } from './components/CreatePatientForm';
import { PatientsList } from './components/PatientsList';
import { createPatientWithOfflineFallback } from './services/offlinePatientQueueService';
import { upsertLocalPatient } from './services/localPatientService';
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

  // The list is now sourced directly from Dexie and updates reactively whenever db.patients changes
  // — from a background drain, a server pull, or an optimistic create. undefined while resolving.
  const patients = useLiveQuery(() => db.patients.toArray());

  const [syncing, setSyncing] = useState(true);
  const [syncError, setSyncError] = useState('');
  const [syncFailed, setSyncFailed] = useState(false);

  const [form, setForm] = useState<PatientFormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [offlineNotice, setOfflineNotice] = useState('');

  // Keeps the local store fresh; it never touches list state (the live query above handles display).
  // A single runSyncCycle() pushes all pending mutations and then, in its post-sync phase, pulls the
  // authoritative patient list back into db.patients — one cycle, one GET. MainLayout stays mounted
  // across navigation, so this remount is the trigger that refreshes the cache on return.
  const reconnectAndLoad = useCallback(async () => {
    setSyncing(true);
    setSyncError('');
    try {
      // runSyncCycle never throws; it reports failure via its return value instead.
      const succeeded = await runSyncCycle();
      if (!succeeded) {
        // Backend unreachable: the list keeps showing whatever is cached locally; we only surface
        // the full-page error (and the Réessayer button) when there is nothing cached — see render
        // below. When the cache is non-empty, syncFailed drives a non-blocking banner instead.
        setSyncError('Impossible de charger la liste des patients.');
        setSyncFailed(true);
      } else {
        setSyncFailed(false);
      }
    } finally {
      setSyncing(false);
    }
  }, []);

  // Wait for auth to be initialized (token restored AND applied to the API client) before syncing,
  // otherwise the request races ahead of the token on a fresh page load and 401s.
  useEffect(() => {
    if (!isInitialized) return;
    reconnectAndLoad();
  }, [isInitialized, reconnectAndLoad]);

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
        // Mirror into the local cache so the reactive list shows the new patient immediately.
        await upsertLocalPatient(outcome.patient);
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

  const count = patients?.length ?? 0;
  const isEmpty = patients !== undefined && count === 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {isAdmin ? 'Mes patients' : 'Patients suivis'}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {count} patient{count !== 1 ? 's' : ''}
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

        <div className="lg:col-span-2 flex flex-col gap-3">
          {syncFailed && !isEmpty && (
            <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <p className="text-sm text-amber-700">Impossible de synchroniser avec le serveur.</p>
              <Button variant="secondary" size="sm" onClick={reconnectAndLoad}>
                <RotateCw className="h-3.5 w-3.5" />
                Réessayer
              </Button>
            </div>
          )}
          <PatientsList
            patients={patients ?? []}
            isLoading={patients === undefined || (syncing && isEmpty)}
            error={!syncing && isEmpty ? syncError : ''}
            onSelectPatient={onSelectPatient}
            onRetry={reconnectAndLoad}
          />
        </div>
      </div>
    </div>
  );
}
