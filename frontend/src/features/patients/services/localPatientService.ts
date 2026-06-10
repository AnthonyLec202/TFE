import { db } from '../../../core/offline/LocalDatabase';
import { getPatients } from '../../../services/patientService';

export async function searchLocalPatients(query: string) {
  if (!query.trim()) return [];
  const lower = query.toLowerCase();
  return db.patients
    .filter(p => p.searchableName.includes(lower))
    .limit(10)
    .toArray();
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
