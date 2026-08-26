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
import { encryptLegacyRecordsAtRest } from '../../../core/offline/recordEncryption';
import {
  rememberConfirmedSession,
  readOfflineSession,
  updateRememberedUser,
  forgetOfflineSession,
} from '../services/offlineSessionService';

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
      // Fire-and-forget: encrypts any row still stored in cleartext by an earlier build, now that a
      // key exists. Not awaited — it must never delay the session becoming usable, and it patches
      // only the encrypted fields, so a sync cycle starting alongside it cannot be disturbed.
      void encryptLegacyRecordsAtRest();
    } catch (err) {
      console.error('[Auth] Encryption key derivation failed.', err);
    }
    setUser(nextUser);
  }

  // On mount, restore the session from the HttpOnly cookie via GET /api/auth/me. The token is never
  // exposed to JS, so the server is the authoritative source of the identity (userId/email/roles).
  // isInitialized flips true only after key derivation completes, so guarded consumers wait for the
  // key — preventing any note read from racing ahead of derivation.
  //
  // Three outcomes, and the distinction between the last two is the point: a server that says no is
  // not the same as a server that cannot be reached. Only the first ends the session.
  useEffect(() => {
    let ignore = false;

    getCurrentUser()
      .then(async restored => {
        if (ignore) return;
        // A server answer, so the offline window starts over here — and only here.
        rememberConfirmedSession(restored);
        await applySession(restored);
      })
      .catch(async err => {
        if (ignore) return;

        if (err instanceof AuthError) {
          // The server actively rejected the session. The local copy is void whatever its age.
          forgetOfflineSession();
          return;
        }

        // The server could not be reached. Fall back to the last confirmed identity while it is
        // still inside its window; past that the clinician signs in again, which needs the network
        // back. Either way the local database is untouched and waits.
        console.warn('[Auth] Session restore failed — trying the offline session.', err);
        const offlineUser = readOfflineSession();
        if (offlineUser) await applySession(offlineUser);
      })
      .finally(() => {
        if (!ignore) setIsInitialized(true);
      });

    return () => { ignore = true; };
  }, []);

  async function login(email: string, password: string): Promise<void> {
    const loggedIn = await apiLogin({ email, password });
    rememberConfirmedSession(loggedIn);
    await applySession(loggedIn);
  }

  async function enroll(data: ConsumeTokenRequest): Promise<void> {
    const enrolled = await apiConsumeToken(data);
    rememberConfirmedSession(enrolled);
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
    // Signing out is deliberate and must not leave a session the next reload could reopen offline.
    forgetOfflineSession();
  }

  function patchUser(partial: Partial<AuthUser>): void {
    setUser(prev => (prev ? { ...prev, ...partial } : null));
    // Keep the stored copy in step, so an offline restore does not resurrect stale fields — a
    // consent version already accepted, for instance, prompting for it again. The validity window is
    // left alone: this is a local edit, not a server confirmation.
    updateRememberedUser(partial);
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
