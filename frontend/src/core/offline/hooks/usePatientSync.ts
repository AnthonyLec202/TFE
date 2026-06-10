import { useEffect } from 'react';
import { syncPatientsFromServer } from '../../../features/patients';

export function usePatientSync(): void {
  useEffect(() => {
    if (!navigator.onLine) return;

    syncPatientsFromServer().catch(err => {
      console.warn('[usePatientSync] Background sync failed — using cached data.', err);
    });
  }, []);
}
