import { X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../ui/Button';

// App-shell chrome surfacing the service-worker lifecycle. With registerType 'prompt', a freshly
// deployed build installs but waits: this toast lets the clinician apply the update deliberately
// (no silent mid-session reload) and confirms first-time offline readiness. It also self-registers
// the service worker via useRegisterSW, so no separate registerSW() call is needed at the entry.
export function PwaUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!offlineReady && !needRefresh) return null;

  function dismiss() {
    setOfflineReady(false);
    setNeedRefresh(false);
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 inset-x-4 z-[100] sm:inset-x-auto sm:right-4 sm:w-[22rem] print:hidden"
    >
      <div className="flex items-start gap-3 rounded-xl border border-sand-200 bg-white px-4 py-3.5 shadow-[0_8px_28px_rgba(45,40,33,0.14)]">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            {needRefresh ? 'Nouvelle version disponible' : 'Prêt pour le hors-ligne'}
          </p>
          <p className="mt-0.5 text-[13px] leading-snug text-taupe-500">
            {needRefresh
              ? 'Rechargez pour appliquer la mise à jour.'
              : "L'application est désormais utilisable sans connexion."}
          </p>
          {needRefresh && (
            <div className="mt-2.5">
              <Button size="sm" onClick={() => updateServiceWorker(true)}>
                Recharger
              </Button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer"
          className="shrink-0 text-taupe-400 transition-colors hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
