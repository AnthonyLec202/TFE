import { useEffect } from 'react';
import { syncPatientsFromServer } from '../services/localPatientService';

/**
 * On mount, refreshes the local patient cache from the server (best-effort). Lives in the patients
 * feature — not core/offline — so the core stays unaware of any specific feature.
 */
export function usePatientSync(): void {
  useEffect(() => {
    if (!navigator.onLine) return;

    syncPatientsFromServer().catch(err => {
      console.warn('[usePatientSync] Background sync failed — using cached data.', err);
    });
  }, []);
}
