import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Lock, UserPlus } from 'lucide-react';
import { useAuth } from '../auth';
import type { CreatePatientPayload } from '../../types/patient';
import { db } from '../../core/offline/LocalDatabase';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { OfflinePill } from '../../components/ui/OfflinePill';
import { CreatePatientForm } from './components/CreatePatientForm';
import { PatientsList, type PatientListItem } from './components/PatientsList';
import { PatientSearch } from './components/PatientSearch';
import { createPatientWithOfflineFallback } from './services/offlinePatientQueueService';
import { upsertLocalPatient, togglePatientArchiveStatus } from './services/localPatientService';
import { getPatientTerminology } from './utils/patientTerminology';
import { runSyncCycle } from '../../core/offline/syncEngine';
import { useGlobalNetworkState } from '../../core/offline/hooks/useGlobalNetworkState';

// The id is generated at submission, so the editable form state omits it.
type PatientFormState = Omit<CreatePatientPayload, 'id'>;
const EMPTY_FORM: PatientFormState = { firstName: '', lastName: '', birthDate: '' };

interface Props {
  onSelectPatient: (id: string) => void;
  onJoinPatient?: () => void;
  // 'active' = the standard "Mes patients" view (create form + non-archived patients).
  // 'archived' = the "Archives" view (no create form, archived patients only).
  mode?: 'active' | 'archived';
}

export function DashboardContainer({ onSelectPatient, onJoinPatient, mode = 'active' }: Props) {
  const { user, isInitialized } = useAuth();
  const isAdmin = user?.roles.includes('Admin') ?? false;
  const archivedView = mode === 'archived';
  // Role-based wording: a psychologist (Admin) manages "patients"; a collaborator works on "dossiers".
  const terms = getPatientTerminology(isAdmin);

  // Single source of truth for connectivity: the hoisted global state, persisted across navigation.
  // The header pill, the offline banner and the empty-cache message all derive from this — never from
  // a transient per-mount sync result — so returning to this page shows the correct state with no flash.
  const isOnline = useGlobalNetworkState();

  // Archived dossiers are private: their collaborative wall is encrypted and can only be decrypted
  // server-side, so a dossier is unreachable without a connection. Offline we still render the cached
  // archive list (read-only consultation), but navigation into a dossier is blocked — see
  // handleSelectPatient — and the cards are visually marked as locked. Active patients are unaffected.
  const lockArchivedNavigation = archivedView && !isOnline;

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

  // Restrict to the current view's archive scope before any display filtering. An offline-queued
  // creation (no isArchived field) defaults to active. This scoped list — not the raw one — drives the
  // count and empty states so "Archives" reports on archived patients only.
  //
  // Sorting is done in-memory here, NOT via Dexie's .orderBy(): names are encrypted at rest ($enc$),
  // so the index would order on ciphertext. By the time the live query resolves the DBCore middleware
  // has decrypted firstName/lastName, so a JS sort here ranks on plaintext. localeCompare('fr') is
  // mandatory so French diacritics collate naturally (e.g. 'É' next to 'E', not after 'Z').
  const scopedPatients = useMemo<PatientListItem[] | undefined>(() => {
    if (patients === undefined) return undefined;
    return patients
      .filter(patient => (patient.isArchived ?? false) === archivedView)
      .sort((a, b) =>
        a.lastName.localeCompare(b.lastName, 'fr', { sensitivity: 'base' }) ||
        a.firstName.localeCompare(b.firstName, 'fr', { sensitivity: 'base' }));
  }, [patients, archivedView]);

  // Case-insensitive substring match on the precomputed "firstname lastname" key. Filtering is
  // display-only — the sync-state logic below keys off the scoped (unsearched) list so an active
  // search never masks the offline banner / empty-cache states.
  const filteredPatients = useMemo<PatientListItem[] | undefined>(() => {
    if (scopedPatients === undefined) return undefined;
    const query = searchTerm.trim().toLowerCase();
    if (query.length === 0) return scopedPatients;
    return scopedPatients.filter(patient => patient.searchableName.includes(query));
  }, [scopedPatients, searchTerm]);

  // Transient spinner only — true while an online sync cycle is actually in flight. Offline status is
  // NOT inferred here; it comes from the global state above.
  const [syncing, setSyncing] = useState(false);

  const [form, setForm] = useState<PatientFormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [offlineNotice, setOfflineNotice] = useState('');
  // Explanatory message shown when an archived dossier is opened while offline (no toast system here).
  const [accessNotice, setAccessNotice] = useState('');

  // Keeps the local store fresh; it never touches list state (the live query above handles display).
  // A single runSyncCycle() pushes all pending mutations and then, in its post-sync phase, pulls the
  // authoritative patient list back into db.patients — one cycle, one GET. MainLayout stays mounted
  // across navigation, so this remount is the trigger that refreshes the cache on return.
  // Runs one cycle and lowers the badge when it settles. Raising the badge is left to the caller, so
  // the automatic path below can raise it during render rather than from inside an effect.
  const runSync = useCallback(async () => {
    try {
      await runSyncCycle(); // never throws; offline status is owned by the global state, not its result
    } finally {
      setSyncing(false);
    }
  }, []);

  // Manual retry from the error panel — an event handler, so it raises the badge itself. Reads the
  // global state first: if we already know the backend is unreachable, do NOT attempt the request.
  // The offline UI is driven by isOnline, not by a doomed fetch's failure.
  const reconnectAndLoad = useCallback(() => {
    if (!isOnline) return;
    setSyncing(true);
    void runSync();
  }, [isOnline, runSync]);

  // Wait for auth to be initialized (token restored AND applied to the API client) before syncing,
  // otherwise the request races ahead of the token on a fresh page load and 401s. Re-runs when
  // connectivity returns (isOnline → true), so the cache refreshes automatically on reconnect.
  const shouldSync = isInitialized && isOnline;
  const [syncGate, setSyncGate] = useState(false);
  if (syncGate !== shouldSync) {
    setSyncGate(shouldSync);
    if (shouldSync) setSyncing(true);
  }

  useEffect(() => {
    if (!shouldSync) return;
    void runSync();
  }, [shouldSync, runSync]);

  // Once connectivity returns the dossier is reachable again, so retract the offline access notice.
  const [noticeOnline, setNoticeOnline] = useState(isOnline);
  if (noticeOnline !== isOnline) {
    setNoticeOnline(isOnline);
    if (isOnline) setAccessNotice('');
  }

  // Connectivity guard for the Archives view. Offline, an archived dossier cannot be decrypted, so we
  // refuse the navigation and surface the reason instead of routing to a screen that would only error.
  // Online (and on the active view), navigation proceeds unchanged.
  function handleSelectPatient(patientId: string): void {
    if (lockArchivedNavigation) {
      setAccessNotice('Consultation locale uniquement. Une connexion internet est requise pour déchiffrer et accéder au dossier privé de ce patient.');
      return;
    }
    onSelectPatient(patientId);
  }

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

  // Toggles a patient's archived flag (admin action). Optimistic local update lives in the service,
  // so the live query reactively moves the card between the active and archived views.
  async function handleToggleArchive(patient: PatientListItem, nextArchived: boolean): Promise<void> {
    try {
      await togglePatientArchiveStatus(patient, nextArchived);
    } catch {
      // The service already reverted the optimistic flag; the row simply stays in place.
    }
  }

  const count = scopedPatients?.length ?? 0;
  const isEmpty = scopedPatients !== undefined && count === 0;

  // Archives lit depuis le cache local et s'affiche donc hors ligne comme "Mes patients" : une liste
  // archivée vide hors ligne relève de l'état vide normal, pas d'une erreur de chargement. On ne signale
  // l'indisponibilité hors ligne (message + bouton Réessayer) que sur la vue active.
  const offlineListError =
    !isOnline && isEmpty && !archivedView
      ? 'Impossible de charger la liste des patients : vous êtes hors ligne.'
      : '';

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif font-semibold text-[clamp(1.5rem,4.5vw,1.875rem)] tracking-[-0.015em] text-ink">
            {archivedView ? 'Archives' : terms.nav_patients}
          </h1>
          <p className="text-[14.5px] text-taupe-500">
            {archivedView
              ? `${count} patient${count !== 1 ? 's' : ''} archivé${count !== 1 ? 's' : ''}`
              : terms.list_count(count)}
          </p>
        </div>
        <SyncBadge syncing={syncing} offline={!isOnline} />
      </div>

      <div
        className={
          archivedView
            ? 'flex flex-col gap-3'
            : 'grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start'
        }
      >
        {/* Create / join sidebar — omitted entirely on the Archives view. */}
        {!archivedView && (
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
                <h2 className="text-[15px] font-semibold text-ink">{terms.join_action}</h2>
                <p className="text-xs text-taupe-500">{terms.join_desc}</p>
                <Button variant="secondary" size="sm" onClick={onJoinPatient} className="w-full">
                  <UserPlus className="h-4 w-4" />
                  {terms.join_action}
                </Button>
              </Card>
            ) : null}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {/* Bandeau "données en cache" masqué sur "Mes patients" (non utile pour l'utilisateur) ;
              conservé sur Archives, où le hors ligne a un impact réel (navigation verrouillée). */}
          {!isOnline && !isEmpty && archivedView && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <p className="text-sm text-amber-700">Hors ligne — affichage des données mises en cache.</p>
            </div>
          )}
          {accessNotice && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <Lock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-700">{accessNotice}</p>
            </div>
          )}
          {!isEmpty && <PatientSearch value={searchTerm} onChange={setSearchTerm} placeholder={terms.search_placeholder} />}
          <PatientsList
            patients={filteredPatients ?? []}
            isLoading={scopedPatients === undefined || (syncing && isEmpty)}
            error={offlineListError}
            emptyMessage={
              searchTerm.trim()
                ? 'Aucun patient ne correspond à votre recherche.'
                : archivedView
                  ? 'Aucun patient archivé.'
                  : undefined
            }
            onSelectPatient={handleSelectPatient}
            lockNavigation={lockArchivedNavigation}
            onRetry={reconnectAndLoad}
            onToggleArchive={isAdmin ? handleToggleArchive : undefined}
          />
        </div>
      </div>
    </div>
  );
}

// Header status indicator. It only signals an active or problematic state — never a passive "all
// good" success pill (that was visual noise). Offline (from the global network state) takes
// precedence; otherwise the transient syncing spinner; otherwise nothing.
function SyncBadge({ syncing, offline }: { syncing: boolean; offline: boolean }) {
  if (offline) return <OfflinePill />;
  if (syncing) {
    return (
      <span className="flex items-center gap-1.5 text-[12.5px] text-taupe-500 bg-sand-100 border border-sand-200 px-3 py-1.5 rounded-full">
        <span className="w-[7px] h-[7px] rounded-full bg-taupe-400 animate-pulse" />
        Synchronisation…
      </span>
    );
  }
  return null;
}
