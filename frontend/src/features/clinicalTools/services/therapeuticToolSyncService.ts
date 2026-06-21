import { getTherapeuticTools } from '../../../services/therapeuticToolService';
import { replaceLocalToolCatalog, toLocalTool } from './localTherapeuticToolService';

// Coalesces concurrent callers onto one in-flight pull, so a single hydration never fires redundant
// GETs (e.g. StrictMode double-invoke, or the mount fetch racing the sync engine's post-sync pull).
let inFlightServerSync: Promise<void> | null = null;

/**
 * Pulls the authoritative tool catalog from the server and reconciles the local IndexedDB mirror.
 * Registered as a post-sync handler (runs once per sync cycle) and also invoked best-effort on the
 * catalog page mount. The catalog is read-only on the client, so there is no push counterpart.
 */
export function syncTherapeuticToolsFromServer(): Promise<void> {
  if (inFlightServerSync) return inFlightServerSync;
  inFlightServerSync = pullAndReconcile().finally(() => { inFlightServerSync = null; });
  return inFlightServerSync;
}

async function pullAndReconcile(): Promise<void> {
  const tools = await getTherapeuticTools();
  await replaceLocalToolCatalog(tools.map(toLocalTool));
}
