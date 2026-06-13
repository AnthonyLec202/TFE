export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5043';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Thrown when the request never reaches/returns from the server — backend unreachable, DNS
 * failure, offline, or an aborted request. This is distinct from an HTTP error *response*, which
 * throws a plain Error carrying the server's message. Callers (e.g. offline-fallback logic) check
 * `error instanceof NetworkError` to tell "couldn't talk to the server" from "server rejected it",
 * without depending on fetch's native failure types (TypeError / DOMException).
 */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null): void {
    this.token = token;
  }

  // Single place where the native fetch rejection is normalized into a NetworkError, so every
  // request method classifies connection failures identically.
  private async safeFetch(path: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(`${API_BASE}${path}`, init);
    } catch (err) {
      throw new NetworkError(err instanceof Error ? err.message : 'Network request failed');
    }
  }

  private async request<T>(method: HttpMethod, path: string, body?: unknown, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const response = await this.safeFetch(path, {
      method,
      headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: init?.cache,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message ?? 'Request failed');
    }

    if (response.status === 204) return undefined as T;
    return response.json();
  }

  // FormData variant: omits Content-Type so the browser sets the multipart boundary automatically.
  async postForm<T>(path: string, body: FormData): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const response = await this.safeFetch(path, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message ?? 'Request failed');
    }

    return response.json();
  }

  // Variant for endpoints that return 200/204 with no body (avoids response.json() error).
  async postVoid(path: string, body: unknown): Promise<void> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const response = await this.safeFetch(path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message ?? 'Request failed');
    }
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
