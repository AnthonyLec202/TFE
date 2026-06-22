import { NetworkError } from '../../services/apiClient';

/**
 * Global, reactive "is the backend reachable?" state. This is a stronger signal than
 * `navigator.onLine`: the browser can report online while the API is down (ERR_CONNECTION_REFUSED,
 * DNS failure, timeout), which would otherwise let a doomed POST/PUT fail silently. The state is
 * seeded from `navigator.onLine`, flipped by the native online/offline events, and — crucially —
 * downgraded/upgraded by the actual outcome of API requests reported via {@link trackApiReachability}.
 *
 * It is a tiny module-level observable consumed through `useApiReachability` (useSyncExternalStore),
 * so any number of components share one source of truth without prop-drilling or a context provider.
 */
type Listener = () => void;

let reachable = navigator.onLine;
const listeners = new Set<Listener>();

function set(next: boolean): void {
  if (reachable === next) return;
  reachable = next;
  listeners.forEach(listener => listener());
}

/** Marks the backend reachable — called after any API request that actually returned a response. */
export function reportApiReachable(): void {
  set(true);
}

/** Marks the backend unreachable — called when an API request fails at the network layer. */
export function reportApiUnreachable(): void {
  set(false);
}

export function getApiReachabilitySnapshot(): boolean {
  return reachable;
}

export function subscribeApiReachability(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Wraps an API call so its outcome updates the global reachability state: a returned response (even a
 * 4xx/5xx HTTP error) proves the backend is reachable; a {@link NetworkError} (connection refused /
 * timeout / offline) proves it is not. The original result/rejection is passed through unchanged.
 */
export async function trackApiReachability<T>(operation: () => Promise<T>): Promise<T> {
  try {
    const result = await operation();
    reportApiReachable();
    return result;
  } catch (err) {
    // Only a true network-layer failure means "unreachable". An HttpError/AuthError is a *response*,
    // so the server is up — leave the reachable state as-is.
    if (err instanceof NetworkError) reportApiUnreachable();
    throw err;
  }
}

// Native connectivity events. Going offline is authoritative (false). Coming back online is
// optimistic (true) — the next tracked request will downgrade again if the backend is still down.
if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => set(false));
  window.addEventListener('online', () => set(true));
}
