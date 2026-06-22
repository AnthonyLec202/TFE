import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { RotateCw, UserPlus } from 'lucide-react';
import { useAuth } from '../auth';
import type { CreatePatientPayload } from '../../types/patient';
import { db } from '../../core/offline/LocalDatabase';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CreatePatientForm } from './components/CreatePatientForm';
import { PatientsList, type PatientListItem } from './components/PatientsList';
import { PatientSearch } from './components/PatientSearch';
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

  // Sourced directly from Dexie and updated reactively. The synced server cache is the primary
  // source; patients still pending in the offline creation queue are merged in below so they show
  // immediately with a "pending" badge — the same UX offline-created sessions already have.
  const syncedPatients = useLiveQuery(() => db.patients.toArray());
  const queuedPatients = useLiveQuery(() => db.offlinePatientQueue.toArray());

  const patients = useMemo<PatientListItem[] | undefined>(() => {
    // Stay in the loading state until the primary (synced) source has resolved.
    if (syncedPatients === undefined) return undefined;

    const syncedIds = new Set(syncedPatients.map(p => p.id));
    const pending: PatientListItem[] = (queuedPatients ?? [])
      // Drop any queue entry whose patient already appears synced (brief post-sync overlap).
      .filter(entry => !syncedIds.has(entry.payload.id))
      .map(entry => ({
        id: entry.payload.id,
        firstName: entry.payload.firstName,
        lastName: entry.payload.lastName,
        searchableName: `${entry.payload.firstName} ${entry.payload.lastName}`.toLowerCase(),
        birthDate: entry.payload.birthDate,
        userRole: 'Admin', // an offline-created patient's creator is always its admin
        syncStatus: 'pending_create',
      }));

    return [...syncedPatients, ...pending];
  }, [syncedPatients, queuedPatients]);

  const [searchTerm, setSearchTerm] = useState('');

  // Case-insensitive substring match on the precomputed "firstname lastname" key. Filtering is
  // display-only — the sync-state logic below keys off the full (unfiltered) list so an active
  // search never masks the offline banner / empty-cache states.
  const filteredPatients = useMemo<PatientListItem[] | undefined>(() => {
    if (patients === undefined) return undefined;
    const query = searchTerm.trim().toLowerCase();
    if (query.length === 0) return patients;
    return patients.filter(patient => patient.searchableName.includes(query));
  }, [patients, searchTerm]);

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
    <div className="flex flex-col gap-7">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif font-semibold text-[30px] tracking-[-0.015em] text-ink">
            {isAdmin ? 'Mes patients' : 'Patients suivis'}
          </h1>
          <p className="text-[14.5px] text-taupe-500">
            {count} patient{count !== 1 ? 's' : ''} suivi{count !== 1 ? 's' : ''}
          </p>
        </div>
        <SyncBadge syncing={syncing} failed={syncFailed} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
        <div>
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

        <div className="flex flex-col gap-3">
          {syncFailed && !isEmpty && (
            <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <p className="text-sm text-amber-700">Impossible de synchroniser avec le serveur.</p>
              <Button variant="secondary" size="sm" onClick={reconnectAndLoad}>
                <RotateCw className="h-3.5 w-3.5" />
                Réessayer
              </Button>
            </div>
          )}
          {!isEmpty && <PatientSearch value={searchTerm} onChange={setSearchTerm} />}
          <PatientsList
            patients={filteredPatients ?? []}
            isLoading={patients === undefined || (syncing && isEmpty)}
            error={!syncing && isEmpty ? syncError : ''}
            emptyMessage={searchTerm.trim() ? 'Aucun patient ne correspond à votre recherche.' : undefined}
            onSelectPatient={onSelectPatient}
            onRetry={reconnectAndLoad}
          />
        </div>
      </div>
    </div>
  );
}

// Header sync indicator mirroring the mockup's pill: green when synced, amber while syncing,
// terracotta/red when the last cycle failed.
function SyncBadge({ syncing, failed }: { syncing: boolean; failed: boolean }) {
  if (syncing) {
    return (
      <span className="flex items-center gap-1.5 text-[12.5px] text-taupe-500 bg-sand-100 border border-sand-200 px-3 py-1.5 rounded-full">
        <span className="w-[7px] h-[7px] rounded-full bg-taupe-400 animate-pulse" />
        Synchronisation…
      </span>
    );
  }
  if (failed) {
    return (
      <span className="flex items-center gap-1.5 text-[12.5px] text-[#B5453C] bg-[#F6E9E6] border border-[#E7CEC8] px-3 py-1.5 rounded-full">
        <span className="w-[7px] h-[7px] rounded-full bg-[#B5453C]" />
        Hors ligne
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[12.5px] text-[#2F7D5B] bg-[#E6F0EA] border border-[#CADDD0] px-3 py-1.5 rounded-full">
      <span className="w-[7px] h-[7px] rounded-full bg-[#2F7D5B]" />
      Synchronisé · à l'instant
    </span>
  );
}
