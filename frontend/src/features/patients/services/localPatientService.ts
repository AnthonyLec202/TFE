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
  await db.patients.bulkPut(mapped);
}
