// Composition-root wiring for the offline sync engine. This is the only place that bridges the
// feature modules to the (feature-agnostic) core engine, which is why core/offline can stay free of
// any feature import. Imported once for its side effects from main.tsx, before the app renders.
import { registerSyncHandler, registerPostSyncHandler } from './core/offline/syncEngine';
import { tolerateRoleRestriction } from './core/offline/roleGatedSync';
import { syncOfflinePatientQueue, syncPatients, syncPatientsFromServer } from './features/patients';
import { syncSessions, syncSessionsFromServer, syncNotesFromServer } from './features/sessions';
import { syncTherapeuticToolsFromServer } from './features/clinicalTools';

// Registration order defines execution order. Patients MUST sync before sessions so a session
// referencing an offline-created patient is pushed only after that patient exists server-side
// (preserving the relational FK link on sync).
registerSyncHandler(syncOfflinePatientQueue);
// Push offline archive/restore toggles (pending_update on existing patients) as PUTs. Independent of
// the creation queue above — that drains POSTs for brand-new patients; this only updates synced ones.
registerSyncHandler(syncPatients);
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

// Cross-device read for sessions. MUST be registered before the notes pull below: post-sync handlers
// run sequentially in registration order, and a pulled note's parent session must already exist
// locally for the workspace's getSessionById lookup to resolve (referential integrity).
//
// Wrapped: SessionSyncController is [Authorize(Roles = "Admin")] at class level, so this GET answers
// 403 for a non-admin account on every cycle. Left unwrapped it would flip the cycle's failure flag
// and surface a false "sync failed" banner. Only the session UI routes are admin-gated client-side,
// so a non-admin never holds local sessions and the push handler above needs no equivalent guard.
registerPostSyncHandler(tolerateRoleRestriction('sessions', async () => {
  await syncSessionsFromServer();
}));

// Cross-device read for session notes: pull the server-decrypted notes and reconcile them into the
// local store (the notes table's encryption hooks re-wrap them in $enc$). Runs after the session push
// so freshly-authored notes are already 'synced' and are not treated as remote overwrites.
// Same admin-only controller as the session pull above, hence the same guard.
registerPostSyncHandler(tolerateRoleRestriction('session notes', async () => {
  await syncNotesFromServer();
}));
