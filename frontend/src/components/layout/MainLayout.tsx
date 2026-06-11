import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { usePatientSync } from '../../core/offline/hooks/usePatientSync';
import { useSyncEngine } from '../../core/offline/hooks/useSyncEngine';

export function MainLayout() {
  usePatientSync();
  // Drives runSyncCycle, which now drains the offline patient queue before pushing sessions.
  useSyncEngine();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
