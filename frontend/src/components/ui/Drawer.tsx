import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Tailwind max-width of the panel. Defaults to a comfortable reading width. */
  widthClass?: string;
}

/**
 * Generic right-hand sliding panel. Dumb and reusable: it owns only the enter/exit animation and the
 * dismissal affordances (backdrop click, X button, Escape). Children are mounted only while open, so
 * a heavy panel body runs its own mount effects on demand rather than on every page render.
 */
export function Drawer({ open, onClose, title, children, widthClass = 'max-w-xl' }: DrawerProps) {
  // Drives the slide/fade transition: flipped on the frame after mount so the panel animates in from
  // the right rather than appearing instantly.
  const [entered, setEntered] = useState(false);

  // Collapsed during render on close, so the transition class is already off for the next paint.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setEntered(false);
  }

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // Dismiss on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop — clicking it closes the drawer. */}
      <div
        className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-300 ${entered ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Sliding panel. */}
      <div
        role="dialog"
        aria-modal="true"
        className={`absolute right-0 top-0 flex h-full w-full ${widthClass} flex-col bg-slate-50 shadow-xl transition-transform duration-300 ease-out ${entered ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="ml-auto inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
