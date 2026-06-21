// Composition-root wiring for the offline sync engine. This is the only place that bridges the
// feature modules to the (feature-agnostic) core engine, which is why core/offline can stay free of
// any feature import. Imported once for its side effects from main.tsx, before the app renders.
import { registerSyncHandler, registerPostSyncHandler } from './core/offline/syncEngine';
import { syncOfflinePatientQueue, syncPatientsFromServer } from './features/patients';
import { syncSessions } from './features/sessions';
import { syncTherapeuticToolsFromServer } from './features/clinicalTools';

// Registration order defines execution order. Patients MUST sync before sessions so a session
// referencing an offline-created patient is pushed only after that patient exists server-side
// (preserving the relational FK link on sync).
registerSyncHandler(syncOfflinePatientQueue);
registerSyncHandler(syncSessions);

// After all pushes complete, hydrate the local patient cache from the server exactly once. The pull
// returns a list we don't need here, so adapt it to the void SyncHandler contract.
registerPostSyncHandler(async () => {
  await syncPatientsFromServer();
});

// The therapeutic tool catalog is read-only on the client, so it has no push handler — only a
// post-sync pull that reconciles the local IndexedDB mirror with the authoritative server list.
registerPostSyncHandler(async () => {
  await syncTherapeuticToolsFromServer();
});
