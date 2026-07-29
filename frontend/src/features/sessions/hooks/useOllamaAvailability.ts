import { useEffect, useSyncExternalStore } from 'react';
import {
  getOllamaAvailabilitySnapshot,
  refreshOllamaAvailability,
  subscribeOllamaAvailability,
  type OllamaAvailability,
} from '../services/ollamaAvailability';

/**
 * Subscribes to the shared local-model availability state and triggers a probe on mount.
 *
 * Returns `null` until the first probe settles, so a caller can render "checking…" instead of
 * momentarily claiming the feature is unavailable.
 *
 * Deliberately NOT tied to `navigator.onLine`: the runtime is on the loopback interface and stays
 * usable with no network at all.
 */
export function useOllamaAvailability(): OllamaAvailability {
  const availability = useSyncExternalStore(
    subscribeOllamaAvailability,
    getOllamaAvailabilitySnapshot,
  );

  useEffect(() => {
    // Concurrent mounts coalesce onto a single probe inside the store.
    void refreshOllamaAvailability();
  }, []);

  return availability;
}
