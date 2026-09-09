import { useEffect, useState, type ReactNode } from 'react';
import {
  getApiReachabilitySnapshot,
  subscribeApiReachability,
  reportApiReachable,
  reportApiUnreachable,
} from './apiReachability';
import { pingApi } from '../../services/healthService';
import { NetworkStateContext } from './networkStateContext';

// How often the background poll re-checks the backend. Short enough that recovery/outage is noticed
// quickly, long enough not to spam the server.
const POLL_INTERVAL_MS = 15_000;


/**
 * Single, hoisted source of truth for backend reachability. Mounted ABOVE the Router so its state
 * and its background poll persist across every client-side route change — a consumer that remounts
 * on navigation reads the already-correct value synchronously, eliminating the "flash of online
 * state" that occurred when each page seeded its own state to `true` and re-pinged on mount.
 *
 * Two inputs feed the same underlying module store, which this provider mirrors into context:
 *  1. the API interceptor (`trackApiReachability`) — instant signal from every real request, and
 *  2. this provider's background poll against the anonymous /health endpoint — independent of which
 *     page is mounted, so reachability stays fresh even on an idle screen.
 */
export function NetworkStateProvider({ children }: { children: ReactNode }) {
  // Seeded synchronously from the persisted store, so the first render already reflects the last
  // known state (no default-true flash).
  const [isOnline, setIsOnline] = useState(getApiReachabilitySnapshot());

  // Mirror the low-level store into React state. Both the interceptor and the poll write to it.
  useEffect(
    () => subscribeApiReachability(() => setIsOnline(getApiReachabilitySnapshot())),
    [],
  );

  // Background poll, running for the whole app lifetime regardless of the mounted route.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function probe(): Promise<void> {
      if (!navigator.onLine) {
        reportApiUnreachable();
        return;
      }
      try {
        await pingApi(controller.signal);
        if (!cancelled) reportApiReachable();
      } catch {
        if (!cancelled) reportApiUnreachable();
      }
    }

    probe(); // run immediately so the state is correct shortly after load
    const intervalId = window.setInterval(probe, POLL_INTERVAL_MS);
    // Re-probe the instant the OS reports connectivity returned, for snappy recovery.
    window.addEventListener('online', probe);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(intervalId);
      window.removeEventListener('online', probe);
    };
  }, []);

  return <NetworkStateContext.Provider value={isOnline}>{children}</NetworkStateContext.Provider>;
}
