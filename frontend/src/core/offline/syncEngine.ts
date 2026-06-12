// Generic, feature-agnostic synchronization orchestrator. It knows nothing about patients,
// sessions, or any specific feature: features register their own push/pull logic as handlers at
// startup (see the composition root), and the engine simply runs them in order on each cycle.

export type SyncHandler = () => Promise<void>;

// Two ordered phases. Push handlers flush local mutations to the server; post-sync handlers then
// pull the authoritative server state back into the local cache. Keeping them separate lets a cycle
// push everything first and hydrate exactly once afterwards, instead of each push handler refreshing
// on its own (which caused redundant GETs).
const pushHandlers: SyncHandler[] = [];
const postSyncHandlers: SyncHandler[] = [];

/**
 * Registers a push handler. Handlers run sequentially in registration order on every cycle, so
 * register dependency-ordered handlers accordingly (e.g. a parent entity before one that
 * references it). Intended to be called once per handler at application startup.
 */
export function registerSyncHandler(handler: SyncHandler): void {
  pushHandlers.push(handler);
}

/**
 * Registers a post-sync hydration handler. These run once, in registration order, AFTER every push
 * handler in the cycle has completed — the single place to pull fresh server state into the local
 * cache. Registering hydration here (rather than inside a push handler) guarantees one pull per
 * cycle regardless of how many mutations were pushed, and keeps the core engine feature-agnostic
 * (the concrete pull is wired from the composition root).
 */
export function registerPostSyncHandler(handler: SyncHandler): void {
  postSyncHandlers.push(handler);
}

/**
 * Runs every registered push handler sequentially, then every post-sync handler. A handler that
 * throws aborts the rest of the cycle — so a handler depending on an earlier one never runs against
 * an inconsistent state, and a failed push skips the pull rather than hydrating from a server we
 * just failed to reach — and the whole cycle is retried on the next invocation.
 *
 * Never throws: a background trigger (e.g. the `online` event) must not produce an unhandled
 * rejection. Returns `true` when the cycle completed (including the offline no-op) and `false` when
 * a handler threw, so a caller that cares — e.g. the dashboard surfacing a "Réessayer" prompt on an
 * empty cache — can react without the engine breaking its resilience contract.
 */
export async function runSyncCycle(): Promise<boolean> {
  if (!navigator.onLine) return true;

  try {
    for (const handler of pushHandlers) {
      await handler();
    }
    for (const handler of postSyncHandlers) {
      await handler();
    }
    return true;
  } catch (err) {
    console.warn('[SyncEngine] Sync cycle failed — will retry next time.', err);
    return false;
  }
}
