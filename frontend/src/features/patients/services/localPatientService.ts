import { db, type LocalPatientSync } from '../../../core/offline/LocalDatabase';
import { getPatients } from '../../../services/patientService';

/** A patient match, tagged with whether it is still pending in the offline creation queue. */
export interface PatientSearchResult extends LocalPatientSync {
  isOffline: boolean;
}

const MAX_RESULTS = 10;

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
      const { id, firstName, lastName } = entry.payload;
      return {
        id,
        firstName,
        lastName,
        searchableName: `${firstName} ${lastName}`.toLowerCase(),
        isOffline: true,
      };
    })
    .filter(p => p.searchableName.includes(lower));

  return [...syncedResults, ...queuedResults].slice(0, MAX_RESULTS);
}

export async function syncPatientsFromServer(): Promise<void> {
  const patients = await getPatients();
  const mapped = patients.map(p => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    searchableName: `${p.firstName} ${p.lastName}`.toLowerCase(),
  }));

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
}
