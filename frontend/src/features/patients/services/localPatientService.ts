import { db } from '../../../core/offline/LocalDatabase';
import type { LocalPatientSync } from '../../../core/offline/LocalDatabase';

export async function searchLocalPatients(query: string): Promise<LocalPatientSync[]> {
  if (!query.trim()) return [];
  const lower = query.toLowerCase();
  return db.patients
    .filter(p => p.searchableName.includes(lower))
    .limit(10)
    .toArray();
}

export async function upsertLocalPatient(patient: LocalPatientSync): Promise<void> {
  await db.patients.put(patient);
}
