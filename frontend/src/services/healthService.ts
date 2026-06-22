import { API_BASE } from './apiClient';

/**
 * Lightweight backend liveness probe used by the global network-state provider's background poll.
 * Resolves when the backend answers, rejects on any network-layer failure (ERR_CONNECTION_REFUSED,
 * DNS, timeout) or non-2xx — exactly the boolean signal reachability needs.
 *
 * Uses raw fetch (not apiClient) on purpose: it must not be confused by auth (a 401 still proves the
 * server is up) and it targets the anonymous /health endpoint, so there is no body/JSON to parse.
 */
export async function pingApi(signal?: AbortSignal): Promise<void> {
  const response = await fetch(`${API_BASE}/health`, { method: 'GET', cache: 'no-store', signal });
  if (!response.ok) throw new Error(`Health check failed with status ${response.status}`);
}
