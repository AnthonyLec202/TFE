import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { useAuth, ConsentBumpModal } from '../../features/auth';
import { usePatientSync } from '../../features/patients';
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

  usePatientSync();
  // Drives runSyncCycle, which now drains the offline patient queue before pushing sessions.
  useSyncEngine();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-8">
        <Outlet />
      </main>
      {/* Blocks all navigation until the user accepts the current policy version. */}
      <ConsentBumpModal />
    </div>
  );
}
