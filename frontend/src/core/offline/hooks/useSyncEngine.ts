import { useEffect } from 'react';
import { runSyncCycle } from '../syncEngine';

export function useSyncEngine(): void {
  useEffect(() => {
    runSyncCycle();
    window.addEventListener('online', runSyncCycle);
    return () => window.removeEventListener('online', runSyncCycle);
  }, []);
}
