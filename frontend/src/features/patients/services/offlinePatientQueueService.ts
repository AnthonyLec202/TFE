import { db, type QueuedPatientCreation } from '../../../core/offline/LocalDatabase';
import type { CreatePatientPayload, PatientResponse } from '../../../types/patient';
import { createPatient } from '../../../services/patientService';
import { NetworkError } from '../../../services/apiClient';

/** Result of a create attempt: either the server created the patient, or it was queued offline. */
export type PatientCreationOutcome =
  | { status: 'created'; patient: PatientResponse }
  | { status: 'queued' };

/**
 * A connection failure (backend unreachable / stopped, DNS, offline) surfaces from the API client
 * as a NetworkError. An HTTP error *response* (e.g. 400 validation) throws a plain Error instead.
 * Only the former should fall back to the offline queue; the latter is a genuine failure to surface.
 */
function isNetworkError(error: unknown): boolean {
  return error instanceof NetworkError;
}

/**
 * Persists a 'Create Patient' payload locally for replay once the backend is reachable again.
 */
async function enqueuePatientCreation(payload: CreatePatientPayload): Promise<void> {
  const entry: QueuedPatientCreation = {
    // Key the queue entry by the client-generated patient id: one entry per patient, and the
    // same id is later used to delete it after a successful sync.
    id: payload.id,
    payload,
    queuedAt: new Date().toISOString(),
  };
  await db.offlinePatientQueue.put(entry);
}

/**
 * Attempts to create the patient on the server. If the request fails because the backend is
 * unreachable, the payload is transparently queued for background sync instead of being lost.
 * Any other error (validation, auth, server fault) is rethrown for the caller to display.
 */
export async function createPatientWithOfflineFallback(
  payload: CreatePatientPayload,
): Promise<PatientCreationOutcome> {
  try {
    const patient = await createPatient(payload);
    return { status: 'created', patient };
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    await enqueuePatientCreation(payload);
    return { status: 'queued' };
  }
}

// A single in-flight drain shared by all concurrent callers. Returning this same promise
// (rather than an early `return`) guarantees that every `await syncOfflinePatientQueue()`
// resolves only once the queue is actually drained — the session sync relies on this to
// order itself strictly after the patient sync.
let inFlightDrain: Promise<void> | null = null;

/**
 * Drains the offline patient-creation queue: POSTs each pending payload in submission order
 * and removes it on success. A failed entry is left in the queue to retry on the next
 * connectivity change, so a single API error never blocks the remaining items or the UI.
 * Concurrent invocations coalesce onto one drain.
 */
export function syncOfflinePatientQueue(): Promise<void> {
  if (!navigator.onLine) return Promise.resolve();
  if (inFlightDrain) return inFlightDrain;
  inFlightDrain = drainPatientQueue().finally(() => { inFlightDrain = null; });
  return inFlightDrain;
}

async function drainPatientQueue(): Promise<void> {
  // Oldest first so patients are created in the order they were queued.
  const queued = await db.offlinePatientQueue.orderBy('queuedAt').toArray();
  for (const entry of queued) {
    try {
      await createPatient(entry.payload);
      await db.offlinePatientQueue.delete(entry.id);
    } catch (err) {
      // Keep the entry queued; a later sync will retry it.
      console.warn('[offlinePatientQueue] Failed to sync a queued patient — will retry later.', err);
    }
  }
  // This handler's sole responsibility is to push. Hydrating db.patients from the server is the job
  // of the engine's post-sync phase, which runs once after every push handler — so the reactive
  // consumers (dashboard list, autocomplete, session cards) refresh without a redundant pull here.
}
