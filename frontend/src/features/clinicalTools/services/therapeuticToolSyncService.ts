import { getTherapeuticTools } from '../../../services/therapeuticToolService';
import { HttpError } from '../../../services/apiClient';
import { trackApiReachability } from '../../../core/offline/apiReachability';
import type { TherapeuticToolResponse } from '../../../types/therapeuticTool';
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
  let tools: TherapeuticToolResponse[];
  try {
    // Tracking this read keeps the global reachability state current on every catalog hydration
    // (e.g. the master/detail page mount), so the offline UI reflects backend availability proactively.
    tools = await trackApiReachability(() => getTherapeuticTools());
  } catch (err) {
    // The tool catalog is an Admin-only resource (the route, the nav entry, and the API endpoint are
    // all restricted to Admin). For a collaborator the GET legitimately returns 403 Forbidden; that
    // is expected, not a real sync failure, so it must not poison the global sync cycle (which would
    // surface a false "Impossible de synchroniser" banner on the patients page). Treat it as a no-op
    // — a non-admin has no catalog to mirror — and let any other error propagate normally.
    if (err instanceof HttpError && err.status === 403) return;
    throw err;
  }
  await replaceLocalToolCatalog(tools.map(toLocalTool));
}
