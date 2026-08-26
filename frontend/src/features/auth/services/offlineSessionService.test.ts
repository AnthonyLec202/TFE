import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  rememberConfirmedSession,
  readOfflineSession,
  updateRememberedUser,
  forgetOfflineSession,
  OFFLINE_SESSION_MAX_AGE_MS,
} from './offlineSessionService';
import type { AuthUser } from '../../../types/auth';

const STORAGE_KEY = 'kideo.auth.offlineSession';
const CONFIRMED_AT = new Date('2026-08-26T09:00:00.000Z').getTime();

const USER: AuthUser = {
  userId: 'a4f1c2d0-0000-4000-8000-000000000001',
  email: 'juliette@exemple.be',
  roles: ['Admin'],
  consentGivenAt: '2026-01-15T10:00:00.000Z',
  consentVersion: '1.2',
};

/** Minimal in-memory Storage, so these suites need no DOM environment. */
function createStorageStub(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: key => void store.delete(key),
    clear: () => store.clear(),
    key: index => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createStorageStub());
  vi.useFakeTimers();
  vi.setSystemTime(CONFIRMED_AT);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('offlineSessionService', () => {
  describe('validity window', () => {
    it('reads back an identity the server has just confirmed', () => {
      rememberConfirmedSession(USER);

      expect(readOfflineSession(CONFIRMED_AT)).toEqual(USER);
    });

    it('returns null when nothing was ever stored', () => {
      expect(readOfflineSession(CONFIRMED_AT)).toBeNull();
    });

    it('honours the identity right up to the end of the window', () => {
      rememberConfirmedSession(USER);

      expect(readOfflineSession(CONFIRMED_AT + OFFLINE_SESSION_MAX_AGE_MS)).toEqual(USER);
    });

    it('refuses the identity past the window', () => {
      rememberConfirmedSession(USER);

      expect(readOfflineSession(CONFIRMED_AT + OFFLINE_SESSION_MAX_AGE_MS + 1)).toBeNull();
    });

    it('clears an expired entry rather than leaving it on the device', () => {
      rememberConfirmedSession(USER);
      readOfflineSession(CONFIRMED_AT + OFFLINE_SESSION_MAX_AGE_MS + 1);

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('is twelve hours long', () => {
      expect(OFFLINE_SESSION_MAX_AGE_MS).toBe(12 * 60 * 60 * 1000);
    });
  });

  describe('the window is not self-renewing', () => {
    it('does not extend the window when the identity is read back', () => {
      // The load-bearing property. If reading refreshed the stamp, a device that never regained a
      // network would keep renewing its own session and the window would never close.
      rememberConfirmedSession(USER);

      expect(readOfflineSession(CONFIRMED_AT + 11 * 60 * 60 * 1000)).toEqual(USER);
      expect(readOfflineSession(CONFIRMED_AT + 13 * 60 * 60 * 1000)).toBeNull();
    });

    it('restarts the window when the server confirms again', () => {
      rememberConfirmedSession(USER);

      const laterConfirmation = CONFIRMED_AT + 11 * 60 * 60 * 1000;
      vi.setSystemTime(laterConfirmation);
      rememberConfirmedSession(USER);

      expect(readOfflineSession(laterConfirmation + 11 * 60 * 60 * 1000)).toEqual(USER);
    });

    it('leaves the window where it was when only the user record is patched', () => {
      rememberConfirmedSession(USER);

      vi.setSystemTime(CONFIRMED_AT + 11 * 60 * 60 * 1000);
      updateRememberedUser({ consentVersion: '2.0' });

      // Patched, but not renewed: still expired at the original deadline.
      expect(readOfflineSession(CONFIRMED_AT + 11 * 60 * 60 * 1000)?.consentVersion).toBe('2.0');
      expect(readOfflineSession(CONFIRMED_AT + 13 * 60 * 60 * 1000)).toBeNull();
    });
  });

  describe('forgetting', () => {
    it('drops the identity on request', () => {
      rememberConfirmedSession(USER);
      forgetOfflineSession();

      expect(readOfflineSession(CONFIRMED_AT)).toBeNull();
    });

    it('is harmless when there is nothing to forget', () => {
      expect(() => forgetOfflineSession()).not.toThrow();
    });
  });

  describe('patching', () => {
    it('merges the change into the stored identity', () => {
      rememberConfirmedSession(USER);
      updateRememberedUser({ consentVersion: '2.0' });

      expect(readOfflineSession(CONFIRMED_AT)).toEqual({ ...USER, consentVersion: '2.0' });
    });

    it('does nothing when no identity is stored', () => {
      updateRememberedUser({ consentVersion: '2.0' });

      expect(readOfflineSession(CONFIRMED_AT)).toBeNull();
    });
  });

  describe('untrusted storage contents', () => {
    it('rejects an entry that is not JSON, and clears it', () => {
      localStorage.setItem(STORAGE_KEY, 'not json at all');

      expect(readOfflineSession(CONFIRMED_AT)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('rejects an entry with no timestamp', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: USER }));

      expect(readOfflineSession(CONFIRMED_AT)).toBeNull();
    });

    it('rejects an entry whose user has no id', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ user: { ...USER, userId: '' }, confirmedAt: CONFIRMED_AT }),
      );

      expect(readOfflineSession(CONFIRMED_AT)).toBeNull();
    });

    it('rejects an entry whose roles are not a list of strings', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ user: { ...USER, roles: [1, 2] }, confirmedAt: CONFIRMED_AT }),
      );

      expect(readOfflineSession(CONFIRMED_AT)).toBeNull();
    });

    it('rejects a bare user record with no envelope', () => {
      // The shape an earlier build might plausibly have written.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(USER));

      expect(readOfflineSession(CONFIRMED_AT)).toBeNull();
    });
  });

  describe('unavailable storage', () => {
    it('degrades to no offline session rather than throwing', () => {
      // Private browsing and storage-blocking settings make these accessors throw outright.
      vi.stubGlobal('localStorage', {
        getItem: () => {
          throw new Error('storage disabled');
        },
        setItem: () => {
          throw new Error('storage disabled');
        },
        removeItem: () => {
          throw new Error('storage disabled');
        },
      } as unknown as Storage);

      expect(() => rememberConfirmedSession(USER)).not.toThrow();
      expect(() => updateRememberedUser({ consentVersion: '2.0' })).not.toThrow();
      expect(() => forgetOfflineSession()).not.toThrow();
      expect(readOfflineSession(CONFIRMED_AT)).toBeNull();
    });
  });
});
