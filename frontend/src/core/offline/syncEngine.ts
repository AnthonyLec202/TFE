// Generic, feature-agnostic synchronization orchestrator. It knows nothing about patients,
// sessions, or any specific feature: features register their own push/pull logic as handlers at
// startup (see the composition root), and the engine simply runs them in order on each cycle.

import { AuthError } from '../../services/apiClient';

export type SyncHandler = () => Promise<void>;

// Invoked once when a cycle observes an AuthError (expired/invalid JWT). The concrete action (clear
// the token / log out) is wired from the composition root so this core engine never imports the
// auth feature — keeping it feature-agnostic.
export type AuthFailureHandler = () => void;

// Two ordered phases. Push handlers flush local mutations to the server; post-sync handlers then
// pull the authoritative server state back into the local cache. Keeping them separate lets a cycle
// push everything first and hydrate exactly once afterwards, instead of each push handler refreshing
// on its own (which caused redundant GETs).
const pushHandlers: SyncHandler[] = [];
const postSyncHandlers: SyncHandler[] = [];
let authFailureHandler: AuthFailureHandler | null = null;

// Module-level mutex. Guarantees a single in-flight cycle: overlapping triggers (mount, the `online`
// event, fire-and-forget calls after a mutation) coalesce onto the running cycle instead of issuing
// redundant HTTP calls and racing on Dexie.
let isSyncing = false;

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
 * Registers the action to run when a cycle encounters an AuthError. Wired from a place that has
 * access to the auth state (e.g. the app shell, passing `logout`), so the engine can escalate an
 * expired token to a logout/redirect rather than silently reporting a generic sync failure.
 */
export function registerAuthFailureHandler(handler: AuthFailureHandler): void {
  authFailureHandler = handler;
}

/**
 * Runs every registered push handler, then every post-sync handler. Each handler is isolated in its
 * own try/catch so that:
 *  - a failing push (e.g. the session sync) never aborts the pipeline, and crucially never skips the
 *    post-sync pull — the authoritative server hydration runs even when an earlier push failed; and
 *  - an expired/invalid JWT (AuthError) is escalated once to the registered auth-failure handler
 *    (logout) instead of surfacing as a generic, unrecoverable sync error.
 *
 * Re-entrant calls coalesce: while a cycle is in flight, further invocations return immediately.
 *
 * Never throws: a background trigger (e.g. the `online` event) must not produce an unhandled
 * rejection. Returns `true` when the cycle completed cleanly (including the offline / already-running
 * no-ops) and `false` when at least one handler failed, so a caller that cares — e.g. the dashboard
 * surfacing a "Réessayer" prompt — can react without the engine breaking its resilience contract.
 */
export async function runSyncCycle(): Promise<boolean> {
  if (!navigator.onLine) return true;
  // Mutex: never overlap cycles. A concurrent trigger coalesces onto the running cycle.
  if (isSyncing) return true;

  isSyncing = true;
  let anyFailure = false;
  let authFailed = false;

  const runIsolated = async (handler: SyncHandler): Promise<void> => {
    try {
      await handler();
    } catch (err) {
      anyFailure = true;
      if (err instanceof AuthError) authFailed = true;
      console.warn('[SyncEngine] A sync handler failed — continuing the cycle.', err);
    }
  };

  try {
    // Push phase — each handler isolated so one failure does not abort the rest.
    for (const handler of pushHandlers) {
      await runIsolated(handler);
    }
    // Post-sync phase — ALWAYS runs, even after a push failure, so the local cache is hydrated
    // from the authoritative server state on every reachable cycle.
    for (const handler of postSyncHandlers) {
      await runIsolated(handler);
    }
  } finally {
    isSyncing = false; // always release the lock, even on an unexpected throw
  }

  // An expired/invalid token cannot be retried — escalate to logout exactly once per cycle.
  if (authFailed && authFailureHandler) authFailureHandler();

  return !anyFailure;
}
