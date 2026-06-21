import { createElement, createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  login as apiLogin,
  consumeToken as apiConsumeToken,
  getCurrentUser,
  logout as apiLogout,
} from '../../../services/authService';
import { AuthError } from '../../../services/apiClient';
import type { AuthContextType, AuthUser, ConsumeTokenRequest } from '../../../types/auth';
import {
  deriveEncryptionKey,
  setActiveEncryptionKey,
  clearActiveEncryptionKey,
} from '../../../core/offline/cryptoService';

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Establishes the session in memory: records the user and derives the at-rest encryption key from
  // the userId before resolving, so no encrypted-note read can race ahead of the key being active.
  async function applySession(nextUser: AuthUser): Promise<void> {
    try {
      const key = await deriveEncryptionKey(nextUser.userId);
      setActiveEncryptionKey(key);
    } catch (err) {
      console.error('[Auth] Encryption key derivation failed.', err);
    }
    setUser(nextUser);
  }

  // On mount, restore the session from the HttpOnly cookie via GET /api/auth/me. The token is never
  // exposed to JS, so the server is the only source of the identity (userId/email/roles). A 401 just
  // means no active session. isInitialized flips true only after key derivation completes, so guarded
  // consumers wait for the key — preventing any note read from racing ahead of derivation.
  useEffect(() => {
    let ignore = false;
    getCurrentUser()
      .then(async restored => {
        if (!ignore) await applySession(restored);
      })
      .catch(err => {
        if (!(err instanceof AuthError)) {
          console.warn('[Auth] Session restore failed.', err);
        }
      })
      .finally(() => {
        if (!ignore) setIsInitialized(true);
      });

    return () => { ignore = true; };
  }, []);

  async function login(email: string, password: string): Promise<void> {
    const loggedIn = await apiLogin({ email, password });
    await applySession(loggedIn);
  }

  async function enroll(data: ConsumeTokenRequest): Promise<void> {
    const enrolled = await apiConsumeToken(data);
    await applySession(enrolled);
  }

  async function logout(): Promise<void> {
    try {
      await apiLogout(); // clears the HttpOnly cookie server-side
    } catch (err) {
      // Best-effort: still tear down the local session even if the request fails.
      console.warn('[Auth] Logout request failed — clearing local session anyway.', err);
    }
    setUser(null);
    clearActiveEncryptionKey(); // wipes the key from the WebCrypto subsystem
  }

  function patchUser(partial: Partial<AuthUser>): void {
    setUser(prev => (prev ? { ...prev, ...partial } : null));
  }

  return createElement(
    AuthContext.Provider,
    { value: { user, isAuthenticated: !!user, isInitialized, login, enroll, logout, patchUser } },
    children
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
