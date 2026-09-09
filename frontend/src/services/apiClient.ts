// Optional chaining on `import.meta.env`: Vite substitutes the whole expression at build time, so
// this is a no-op in the bundle, but it lets these modules also be loaded by a plain Node runtime
// (test harnesses) where `import.meta` carries no `env`.
export const API_BASE = import.meta.env?.VITE_API_URL ?? 'http://localhost:5043';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Thrown when the request never reaches/returns from the server — backend unreachable, DNS
 * failure, offline, or an aborted request. This is distinct from an HTTP error *response*, which
 * throws a plain Error carrying the server's message. Callers (e.g. offline-fallback logic) check
 * `error instanceof NetworkError` to tell "couldn't talk to the server" from "server rejected it",
 * without depending on fetch's native failure types (TypeError / DOMException).
 */
export class NetworkError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'NetworkError';
  }
}

/**
 * Thrown for any non-ok HTTP *response*. Carries the numeric `status` so callers can branch on it
 * without re-parsing the response — e.g. the session sync treating a 404 on DELETE as success.
 */
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * Thrown specifically for HTTP 401 Unauthorized (expired/invalid JWT). A subclass of HttpError so
 * generic `instanceof HttpError` checks still match, while callers that care about authentication
 * can detect it precisely (`instanceof AuthError`) and trigger a logout instead of a generic error.
 */
export class AuthError extends HttpError {
  constructor(message: string) {
    super(401, message);
    this.name = 'AuthError';
  }
}

class ApiClient {
  // Single place where the native fetch rejection is normalized into a NetworkError, so every
  // request method classifies connection failures identically. `credentials: 'include'` is forced
  // on every request so the browser transmits the HttpOnly session cookie (F-02) cross-origin; the
  // JWT is never held in JS, so there is no Authorization header to set.
  private async safeFetch(path: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(`${API_BASE}${path}`, { ...init, credentials: 'include' });
    } catch (err) {
      throw new NetworkError('La connexion au serveur a échoué.', { cause: err });
    }
  }

  // Single place where a non-ok HTTP response is classified into a typed error, so every request
  // method surfaces 401 as AuthError and all other statuses as HttpError carrying the status code.
  private async raiseForStatus(response: Response): Promise<never> {
    const body = await response.json().catch(() => ({ message: 'La requête a échoué.' }));
    const message = body.message ?? 'La requête a échoué.';
    if (response.status === 401) throw new AuthError(message);
    throw new HttpError(response.status, message);
  }

  private async request<T>(method: HttpMethod, path: string, body?: unknown, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    const response = await this.safeFetch(path, {
      method,
      headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: init?.cache,
    });

    if (!response.ok) await this.raiseForStatus(response);

    if (response.status === 204) return undefined as T;
    return response.json();
  }

  // FormData variant: omits Content-Type so the browser sets the multipart boundary automatically.
  async postForm<T>(path: string, body: FormData): Promise<T> {
    const response = await this.safeFetch(path, {
      method: 'POST',
      body,
    });

    if (!response.ok) await this.raiseForStatus(response);

    return response.json();
  }

  // Variant for endpoints that return 200/204 with no body (avoids response.json() error).
  async postVoid(path: string, body: unknown): Promise<void> {
    const response = await this.safeFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) await this.raiseForStatus(response);
  }

  get<T>(path: string, init?: RequestInit): Promise<T> {
    return this.request('GET', path, undefined, init);
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request('POST', path, body);
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return this.request('PUT', path, body);
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request('PATCH', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request('DELETE', path);
  }
}

export const apiClient = new ApiClient();
