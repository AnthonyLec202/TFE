import type { LocalTherapeuticTool } from '../../../core/offline/LocalDatabase';
import type {
  CreateTherapeuticToolPayload,
  UpdateTherapeuticToolPayload,
} from '../../../types/therapeuticTool';
import {
  createTherapeuticTool,
  updateTherapeuticTool,
  deleteTherapeuticTool,
} from '../../../services/therapeuticToolService';
import { trackApiReachability } from '../../../core/offline/apiReachability';
import { toLocalTool, upsertLocalTool, removeLocalTool } from './localTherapeuticToolService';

/**
 * Write side of the catalog (admin-only). Each command performs the authoritative server mutation
 * first, then — on success — updates the local Dexie mirror synchronously so the reactive UI reflects
 * the change immediately, without waiting for the next hydration cycle.
 *
 * The catalog is server-authoritative (unlike sessions, which are offline-first), so these commands
 * require connectivity: a failed request rejects without touching the cache, keeping the mirror
 * consistent with the server.
 */

export async function createTool(payload: CreateTherapeuticToolPayload): Promise<LocalTherapeuticTool> {
  // trackApiReachability flips the global offline state if the POST fails at the network layer
  // (backend down), so the UI locks instead of silently dropping the write.
  const created = await trackApiReachability(() => createTherapeuticTool(payload));
  const local = toLocalTool(created);
  await upsertLocalTool(local);
  return local;
}

/**
 * Edit-side command backing the detail page's debounced auto-save. The local Dexie mirror is updated
 * first (optimistic) so the reactive UI reflects the keystroke-driven edit immediately, then the
 * authoritative PUT is pushed. The catalog is server-authoritative, so a rejected PUT propagates to
 * the caller (which surfaces a "save failed" state); the local mirror is reconciled to the server on
 * the next hydration cycle.
 */
export async function updateTool(id: string, payload: UpdateTherapeuticToolPayload): Promise<void> {
  await upsertLocalTool({ id, ...payload });
  await trackApiReachability(() => updateTherapeuticTool(id, payload));
}

export async function deleteTool(id: string): Promise<void> {
  await trackApiReachability(() => deleteTherapeuticTool(id));
  await removeLocalTool(id);
}
