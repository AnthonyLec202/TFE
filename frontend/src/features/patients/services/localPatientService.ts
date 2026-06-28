import { db, type LocalPatientSync, type SyncStatus } from '../../../core/offline/LocalDatabase';
import type { PatientResponse } from '../../../types/patient';
import { getPatients, updatePatient } from '../../../services/patientService';
import { AuthError } from '../../../services/apiClient';

const SYNCED: SyncStatus = 'synced';

/** A patient match, tagged with whether it is still pending in the offline creation queue. */
export interface PatientSearchResult extends LocalPatientSync {
  isOffline: boolean;
}

const MAX_RESULTS = 10;

/** Projects a server PatientResponse into the local cache shape (single source of the mapping). */
function toLocalPatient(p: PatientResponse): LocalPatientSync {
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    searchableName: `${p.firstName} ${p.lastName}`.toLowerCase(),
    birthDate: p.birthDate,
    userRole: p.userRole,
    email: p.email ?? null,
    phoneNumber: p.phoneNumber ?? null,
    postalAddress: p.postalAddress ?? null,
    isArchived: p.isArchived,
  };
}

/**
 * Flips a patient's archived flag and persists it. Updates the local cache optimistically so the
 * reactive lists (Mes patients / Archives) react instantly. The existing contact fields are forwarded
 * unchanged so the toggle never wipes them.
 *
 * Connectivity-aware, mirroring the offline-create fallback:
 *  - Offline (`!navigator.onLine`): the server call is bypassed entirely. The row is written with
 *    `syncStatus: 'pending_update'`, flagging it for the syncPatients push handler to PUT once
 *    connectivity returns. The live query moves the card between the active/archived lists instantly.
 *  - Online: the change is pushed immediately and the authoritative server record (no syncStatus →
 *    synced) is stored. On failure the optimistic flag is rolled back and the error rethrown.
 */
export async function togglePatientArchiveStatus(
  patient: LocalPatientSync,
  isArchived: boolean,
): Promise<void> {
  if (!navigator.onLine) {
    // Optimistic local toggle, flagged for background sync. No POST/PUT is attempted here — the
    // patient already exists server-side, so syncPatients will replay this as an update on reconnect.
    await db.patients.put({ ...patient, isArchived, syncStatus: 'pending_update' });
    return;
  }

  await db.patients.put({ ...patient, isArchived });
  try {
    const updated = await updatePatient(patient.id, {
      firstName: patient.firstName,
      lastName: patient.lastName,
      birthDate: patient.birthDate,
      email: patient.email ?? null,
      phoneNumber: patient.phoneNumber ?? null,
      postalAddress: patient.postalAddress ?? null,
      isArchived,
    });
    await db.patients.put(toLocalPatient(updated));
  } catch (error) {
    await db.patients.put({ ...patient }); // revert the optimistic flag
    throw error;
  }
}

/**
 * Pushes pending patient updates (archive/restore toggles made offline) to the server. Mirrors the
 * update phase of syncSessions: each 'pending_update' patient is PUT, then the authoritative server
 * record is stored locally (clearing the flag). A failure leaves the row pending for the next cycle;
 * an AuthError is re-thrown so the engine escalates to logout rather than swallowing an expired token.
 *
 * Registered as a core sync push handler. These patients already exist server-side (they live in
 * db.patients, not the offline creation queue), so they are replayed as updates (PUT) — never as new
 * creations (POST).
 */
export async function syncPatients(): Promise<void> {
  const pending = await db.patients.filter(p => p.syncStatus === 'pending_update').toArray();
  if (pending.length === 0) return;

  for (const patient of pending) {
    try {
      const updated = await updatePatient(patient.id, {
        firstName: patient.firstName,
        lastName: patient.lastName,
        birthDate: patient.birthDate,
        email: patient.email ?? null,
        phoneNumber: patient.phoneNumber ?? null,
        postalAddress: patient.postalAddress ?? null,
        isArchived: patient.isArchived ?? false,
      });
      await db.patients.put(toLocalPatient(updated));
    } catch (err) {
      if (err instanceof AuthError) throw err;
      console.warn('[patientSync] Failed to push a patient update — will retry later.', patient.id, err);
    }
  }
}

/**
 * Writes a single patient into the local cache (e.g. right after an online create) so the reactive
 * dashboard list reflects it immediately, without waiting for a full re-sync.
 */
export async function upsertLocalPatient(patient: PatientResponse): Promise<void> {
  await db.patients.put(toLocalPatient(patient));
}

/**
 * Searches both the synced server cache (db.patients) and the offline creation queue
 * (db.offlinePatientQueue), so a patient created offline is immediately linkable — e.g. when
 * assigning patients to a new session — before it has been synced to the server.
 */
export async function searchLocalPatients(query: string): Promise<PatientSearchResult[]> {
  if (!query.trim()) return [];
  const lower = query.toLowerCase();

  const synced = await db.patients
    .filter(p => p.searchableName.includes(lower))
    .limit(MAX_RESULTS)
    .toArray();
  const syncedResults: PatientSearchResult[] = synced.map(p => ({ ...p, isOffline: false }));

  // Pending offline patients. Skip any already present in the synced cache (i.e. just synced)
  // so a patient never appears twice during the brief overlap window.
  const syncedIds = new Set(synced.map(p => p.id));
  const queued = await db.offlinePatientQueue.toArray();
  const queuedResults: PatientSearchResult[] = queued
    .filter(entry => !syncedIds.has(entry.payload.id))
    .map(entry => {
      const { id, firstName, lastName, birthDate } = entry.payload;
      return {
        id,
        firstName,
        lastName,
        searchableName: `${firstName} ${lastName}`.toLowerCase(),
        birthDate,
        userRole: 'Admin', // an offline-created patient's creator is always its admin
        isOffline: true,
      };
    })
    .filter(p => p.searchableName.includes(lower));

  return [...syncedResults, ...queuedResults].slice(0, MAX_RESULTS);
}

/**
 * Removes a patient from the local search cache. Call this right after a successful server-side
 * delete so the patient disappears from the autocomplete immediately, instead of lingering until
 * the next full syncPatientsFromServer (e.g. a page refresh).
 */
export async function removeLocalPatient(id: string): Promise<void> {
  await db.patients.delete(id);
}

// Coalesces concurrent callers onto one in-flight pull, so a single reconcile never fires
// redundant GETs (e.g. StrictMode double-invoke, or two triggers racing on reconnect).
let inFlightServerSync: Promise<PatientResponse[]> | null = null;

/**
 * Pulls the authoritative patient list from the server, reconciles the local Dexie cache
 * (db.patients) against it, and RETURNS the list — so a single GET can both hydrate the cache and
 * feed the dashboard's React state, instead of two separate fetches.
 */
export function syncPatientsFromServer(): Promise<PatientResponse[]> {
  if (inFlightServerSync) return inFlightServerSync;
  inFlightServerSync = pullAndReconcilePatients().finally(() => { inFlightServerSync = null; });
  return inFlightServerSync;
}

async function pullAndReconcilePatients(): Promise<PatientResponse[]> {
  const patients = await getPatients();
  // Persist the complete profile (not just id/name) so the local store mirrors the server record.
  const mapped: LocalPatientSync[] = patients.map(toLocalPatient);

  const serverIds = new Set(mapped.map(p => p.id));

  // Reconcile the local cache with the authoritative server list. A plain bulkPut is
  // additive only, so patients deleted server-side would linger here and keep showing
  // up in the autocomplete. Prune the stale ids before upserting the current set.
  await db.transaction('rw', db.patients, async () => {
    // Rows with un-pushed local changes (e.g. an offline archive/restore toggle) must survive the
    // pull untouched — local pending always wins until syncPatients has pushed it (the same guarantee
    // syncSessionsFromServer gives). They are neither overwritten by the older server copy nor pruned.
    const localPatients = await db.patients.toArray();
    const pendingIds = new Set(
      localPatients.filter(p => p.syncStatus && p.syncStatus !== SYNCED).map(p => p.id),
    );

    const staleIds = localPatients
      .filter(p => !serverIds.has(p.id) && !pendingIds.has(p.id))
      .map(p => p.id);
    if (staleIds.length > 0) await db.patients.bulkDelete(staleIds);

    await db.patients.bulkPut(mapped.filter(p => !pendingIds.has(p.id)));
  });

  return patients;
}
