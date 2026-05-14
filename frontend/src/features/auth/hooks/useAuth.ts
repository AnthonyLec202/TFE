import { createElement, createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiClient } from '../../../services/apiClient';
import { login as apiLogin, consumeToken as apiConsumeToken } from '../../../services/authService';
import type { AuthContextType, AuthUser, ConsumeTokenRequest } from '../../../types/auth';

const TOKEN_KEY = 'np_auth_token';

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return {};
  }
}

function isTokenExpired(token: string): boolean {
  const { exp } = decodeJwtPayload(token);
  if (!exp || typeof exp !== 'number') return true;
  return Date.now() >= exp * 1000;
}

function parseUser(token: string): AuthUser | null {
  const payload = decodeJwtPayload(token);
  const userId = payload['sub'] as string | undefined;
  const email = payload['email'] as string | undefined;
  if (!userId || !email) return null;

  // Support both the short "role" claim and the full Microsoft URI claim type
  const raw =
    payload['role'] ??
    payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
  const roles: string[] = !raw
    ? []
    : Array.isArray(raw)
    ? (raw as string[])
    : [raw as string];

  return { userId, email, roles };
}

function loadStoredToken(): string | null {
  const stored = localStorage.getItem(TOKEN_KEY);
  if (stored && !isTokenExpired(stored)) return stored;
  localStorage.removeItem(TOKEN_KEY);
  return null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(loadStoredToken);
  const [user, setUser] = useState<AuthUser | null>(() => {
    const t = loadStoredToken();
    return t ? parseUser(t) : null;
  });

  useEffect(() => {
    apiClient.setToken(token);
  }, [token]);

  function storeAuth(newToken: string): void {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(parseUser(newToken));
    apiClient.setToken(newToken);
  }

  async function login(email: string, password: string): Promise<void> {
    const response = await apiLogin({ email, password });
    storeAuth(response.token);
  }

  async function enroll(data: ConsumeTokenRequest): Promise<void> {
    const response = await apiConsumeToken(data);
    storeAuth(response.token);
  }

  function logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    apiClient.setToken(null);
  }

  return createElement(
    AuthContext.Provider,
    { value: { user, token, isAuthenticated: !!token, login, enroll, logout } },
    children
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
