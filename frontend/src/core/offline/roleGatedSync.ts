// Cross-cutting helper for sync handlers that target a role-restricted resource.
//
// Some API resources are gated server-side by [Authorize(Roles = "Admin")] on the whole controller
// (the session sync endpoints, the therapeutic tool catalog). For an account without that role the
// server answers 403 Forbidden. That is the specified behaviour, not a failure — but the sync engine
// cannot know it: `runIsolated` treats any throw as a failed handler, flips `anyFailure`, and makes
// `runSyncCycle()` return false, which surfaces a false "sync failed" banner in the UI.
//
// The knowledge "a 403 on THIS resource is expected" is call-site specific, so it is applied per
// handler at the composition root rather than in the HTTP client (which cannot distinguish an
// expected role gate from a genuine authorization error the UI must react to) or in the engine
// (which must stay feature-agnostic).

import { HttpError } from '../../services/apiClient';
import type { SyncHandler } from './syncEngine';

/**
 * Narrows an unknown rejection to an HTTP 403 Forbidden response.
 *
 * Cannot match an AuthError: that subclass is constructed with status 401, so an expired/invalid JWT
 * never satisfies this predicate and always keeps propagating to the engine's logout escalation.
 */
export function isForbiddenError(error: unknown): error is HttpError {
  return error instanceof HttpError && error.status === 403;
}

/**
 * Decorates a sync handler so an expected 403 on a role-restricted resource resolves as a no-op
 * instead of poisoning the cycle. Every other rejection — NetworkError, AuthError, 4xx/5xx — keeps
 * propagating untouched, so genuine failures still mark the cycle failed and trigger a retry.
 *
 * `resource` is not read at runtime; it documents at the registration site which resource is gated,
 * so the tolerated status is auditable from the composition root alone.
 */
export function tolerateRoleRestriction(resource: string, handler: SyncHandler): SyncHandler {
  void resource;
  return async () => {
    try {
      await handler();
    } catch (error) {
      // A non-privileged account has nothing to mirror for this resource: dropping the pull leaves
      // the local cache untouched, which is the correct end state.
      if (!isForbiddenError(error)) throw error;
    }
  };
}
