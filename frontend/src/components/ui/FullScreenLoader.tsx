import { Loader2 } from 'lucide-react';

interface FullScreenLoaderProps {
  /** What the application is waiting on, phrased for the user. */
  message?: string;
}

/**
 * Full-viewport waiting state, for the window before the application knows enough to render anything
 * meaningful — chiefly the session restore, which has to settle before a route guard can tell "not
 * signed in" apart from "not loaded yet".
 */
export function FullScreenLoader({ message = 'Chargement…' }: FullScreenLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen bg-sand-50 flex items-center justify-center gap-2 text-taupe-400"
    >
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">{message}</span>
    </div>
  );
}
