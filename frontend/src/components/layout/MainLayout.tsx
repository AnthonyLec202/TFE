import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { useAuth, ConsentBumpModal } from '../../features/auth';
import { useSyncEngine } from '../../core/offline/hooks/useSyncEngine';
import { registerAuthFailureHandler } from '../../core/offline/syncEngine';

export function MainLayout() {
  const { logout } = useAuth();

  // Escalate an expired/invalid token observed during a background sync to a real logout: clearing
  // the token flips isAuthenticated, so ProtectedRoute redirects to /login. Wired here (rather than
  // in the engine) so the feature-agnostic core never imports the auth feature.
  useEffect(() => {
    registerAuthFailureHandler(logout);
  }, [logout]);

  // Single hydration path: runSyncCycle drains the offline patient queue and pushes sessions, then
  // its post-sync handler pulls the authoritative patient list into the cache. It runs on mount and
  // on every reconnect (online event), so the cache is hydrated exactly once per init/reconnect — no
  // separate usePatientSync pull racing alongside it.
  useSyncEngine();

  return (
    <div className="min-h-screen bg-sand-50 flex flex-col">
      <Navbar />
      <main className="flex-1 w-full max-w-[1040px] mx-auto px-4 sm:px-6 py-9">
        <Outlet />
      </main>
      {/* Blocks all navigation until the user accepts the current policy version. */}
      <ConsentBumpModal />
    </div>
  );
}
