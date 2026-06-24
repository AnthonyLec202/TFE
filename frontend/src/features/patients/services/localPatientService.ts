import { db, type LocalPatientSync } from '../../../core/offline/LocalDatabase';
import type { PatientResponse } from '../../../types/patient';
import { getPatients, updatePatient } from '../../../services/patientService';

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
 * reactive lists (Mes patients / Archives) react instantly, then pushes the change to the server via
 * the patient update endpoint. The existing contact fields are forwarded unchanged so the toggle
 * never wipes them. On failure the optimistic change is rolled back.
 */
export async function togglePatientArchiveStatus(
  patient: LocalPatientSync,
  isArchived: boolean,
): Promise<void> {
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
    const localIds = (await db.patients.toCollection().primaryKeys()) as string[];
    const staleIds = localIds.filter(id => !serverIds.has(id));
    if (staleIds.length > 0) await db.patients.bulkDelete(staleIds);
    await db.patients.bulkPut(mapped);
  });

  return patients;
}
