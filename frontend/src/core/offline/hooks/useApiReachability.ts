import { useSyncExternalStore } from 'react';
import {
  subscribeApiReachability,
  getApiReachabilitySnapshot,
} from '../apiReachability';

/**
 * Reactive boolean: `true` while the backend API is believed reachable, `false` when the browser is
 * offline OR a recent API request failed at the network layer (ERR_CONNECTION_REFUSED, timeout).
 *
 * Prefer this over the bare `useNetworkStatus` (navigator.onLine) for any UI that gates writes: it
 * also catches the "LAN up but backend down" case, locking the editor instead of letting a PUT fail
 * silently. Backed by a shared module-level store, so all consumers stay in sync.
 */
export function useApiReachability(): boolean {
  return useSyncExternalStore(subscribeApiReachability, getApiReachabilitySnapshot);
}
