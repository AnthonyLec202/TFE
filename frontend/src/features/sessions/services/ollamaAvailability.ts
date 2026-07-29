/**
 * Reactive "is a local model usable right now?" state, kept strictly separate from the backend
 * reachability signal in `core/offline/apiReachability.ts`.
 *
 * Two audit findings converge here:
 *
 *  - The local runtime lives on the loopback interface, so it stays usable while the machine is
 *    offline. Gating generation on `navigator.onLine` — the predicate the rest of the app uses —
 *    would disable the feature in exactly the situation it exists for.
 *  - Conversely, a stopped Ollama says nothing about the backend. Reporting it through
 *    `trackApiReachability` would flip the whole application into offline mode because a local
 *    model is not running.
 *
 * Same tiny module-level observable shape as apiReachability, consumed through
 * `useOllamaAvailability` (useSyncExternalStore), so any number of components share one probe
 * result without a context provider.
 */
import { probeOllama } from '../../../services/ollamaClient';

/** null = not probed yet, so the UI can distinguish "checking" from "confirmed unavailable". */
export type OllamaAvailability = boolean | null;

type Listener = () => void;

let available: OllamaAvailability = null;
let inFlight: Promise<boolean> | null = null;
const listeners = new Set<Listener>();

function set(next: OllamaAvailability): void {
  if (available === next) return;
  available = next;
  listeners.forEach(listener => listener());
}

export function getOllamaAvailabilitySnapshot(): OllamaAvailability {
  return available;
}

export function subscribeOllamaAvailability(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Probes the runtime and publishes the result. Concurrent callers coalesce onto the in-flight probe
 * rather than each opening their own connection — several components may mount at once.
 */
export function refreshOllamaAvailability(): Promise<boolean> {
  if (inFlight) return inFlight;

  inFlight = probeOllama()
    .then(reachable => {
      set(reachable);
      return reachable;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/**
 * Records the outcome of a real generation. More authoritative than the probe: a generation that
 * actually streamed proves the runtime works, and one that failed to connect proves it does not —
 * whatever the last probe concluded.
 */
export function reportOllamaOutcome(reachable: boolean): void {
  set(reachable);
}
