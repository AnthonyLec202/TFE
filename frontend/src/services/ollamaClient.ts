/**
 * Raw HTTP client for a locally-installed Ollama runtime.
 *
 * Deliberately separate from `apiClient`, for three reasons that are not stylistic:
 *
 *  1. `apiClient.safeFetch` forces `credentials: 'include'` on every request. Ollama answers
 *     `Access-Control-Allow-Origin: *`, and the wildcard is incompatible with credentialed mode —
 *     the browser would discard an otherwise successful response.
 *  2. Cookies are NOT scoped by port. In local development the API and Ollama share the `localhost`
 *     host, so a credentialed request would hand the `np_auth_token` session JWT to the Ollama
 *     process. `credentials: 'omit'` below is a security boundary, not a detail.
 *  3. `trackApiReachability` flips the global "backend reachable" state on a network failure. Routing
 *     Ollama through it would make a stopped local model look like a backend outage and put the whole
 *     application into offline mode.
 */

// Optional chaining: see the note in apiClient.ts — a no-op once Vite substitutes the expression.
export const OLLAMA_BASE = import.meta.env?.VITE_OLLAMA_URL ?? 'http://127.0.0.1:11434';

/**
 * `127.0.0.1` rather than `localhost` by default: Ollama binds IPv4 by default, while `localhost`
 * may resolve to `::1` first on some systems, and the two spellings are not treated identically by
 * every browser's local-network policy.
 */
export const OLLAMA_MODEL = import.meta.env?.VITE_OLLAMA_MODEL ?? 'qwen2.5:7b';

/** Why a call to the local runtime failed — drives the guidance shown to the clinician. */
export type OllamaFailureKind =
  /** The request never left the browser, or nothing answered on the port. */
  | 'unreachable'
  /** Ollama answered, but with an HTTP error (unknown model, malformed request…). */
  | 'http'
  /** Ollama answered but the stream ended malformed. */
  | 'protocol';

export class OllamaError extends Error {
  readonly kind: OllamaFailureKind;
  /** Actionable, user-facing explanation. Empty when no specific advice applies. */
  readonly hint: string;

  constructor(kind: OllamaFailureKind, message: string, hint = '') {
    super(message);
    this.name = 'OllamaError';
    this.kind = kind;
    this.hint = hint;
  }
}

/**
 * Builds the guidance for an `unreachable` failure.
 *
 * A browser cannot tell us WHY a cross-origin request to the loopback interface died: a refused
 * connection, a mixed-content block and a Private Network Access denial all surface as the same
 * opaque `TypeError: Failed to fetch`. What we can do is use the page's own scheme to rank the
 * likely causes, because the failure modes differ sharply between the two:
 *
 *  - Served over HTTPS (deployed), the request is public-origin → loopback. That crosses both the
 *    mixed-content boundary and the private-network boundary, and browser policy there is actively
 *    changing. A block is at least as likely as Ollama simply being stopped.
 *  - Served over HTTP (local dev), no such boundary is crossed, so the realistic causes are Ollama
 *    being stopped or its CORS allow-list not naming this origin.
 */
export function describeUnreachable(): string {
  const isSecurePage = typeof window !== 'undefined' && window.location.protocol === 'https:';

  if (isSecurePage) {
    return (
      "Le navigateur n'a pas pu joindre le moteur d'IA local. Soit Ollama n'est pas démarré, soit " +
      'votre navigateur bloque les requêtes de cette page sécurisée vers votre machine. ' +
      `Vérifiez qu'Ollama tourne, et qu'il autorise l'origine ${window.location.origin} ` +
      '(variable OLLAMA_ORIGINS).'
    );
  }

  return (
    "Le moteur d'IA local n'a pas répondu. Vérifiez qu'Ollama est démarré, et qu'il autorise " +
    "l'origine de cette page via la variable d'environnement OLLAMA_ORIGINS."
  );
}

/**
 * Liveness probe. Resolves true when a local Ollama answers, false otherwise — it never throws, so
 * callers can poll it without a try/catch.
 *
 * `/api/tags` is a cheap read that needs no model loaded, and `credentials: 'omit'` keeps the session
 * cookie away from this origin (see the header note).
 */
export async function probeOllama(timeoutMs = 2500): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE}/api/tags`, {
      method: 'GET',
      credentials: 'omit',
      mode: 'cors',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok;
  } catch {
    return false;
  }
}
