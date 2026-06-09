import { useEffect } from 'react';
import { db } from '../LocalDatabase';
import { fetchPatientsSummary } from '../../../features/patients/services/patientApiService';

export function usePatientSync(): void {
  useEffect(() => {
    if (!navigator.onLine) return;

    fetchPatientsSummary()
      .then(patients => {
        const mapped = patients.map(p => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          searchableName: `${p.firstName} ${p.lastName}`.toLowerCase(),
        }));
        return db.patients.bulkPut(mapped);
      })
      .catch(err => {
        console.warn('[usePatientSync] Background sync failed — using cached data.', err);
      });
  }, []);
}
