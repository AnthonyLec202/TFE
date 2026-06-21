import type { LocalTherapeuticTool } from '../../../core/offline/LocalDatabase';
import type { CreateTherapeuticToolPayload } from '../../../types/therapeuticTool';
import {
  createTherapeuticTool,
  deleteTherapeuticTool,
} from '../../../services/therapeuticToolService';
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
  const created = await createTherapeuticTool(payload);
  const local = toLocalTool(created);
  await upsertLocalTool(local);
  return local;
}

export async function deleteTool(id: string): Promise<void> {
  await deleteTherapeuticTool(id);
  await removeLocalTool(id);
}
