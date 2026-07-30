import { Loader2, PenLine, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { formatSessionDate } from '../utils/sessionFormatters';
import type { PendingStrokeNote } from '../services/pendingStrokesService';

export interface PendingStrokesPanelProps {
  /** Notes still holding unconverted strokes, newest session first. Never empty when rendered. */
  notes: PendingStrokeNote[];
  /** Note id currently being converted, or null. */
  convertingNoteId: string | null;
  /** True while the sequential batch retry is running. */
  isConvertingAll: boolean;
  /** Per-note failure messages, keyed by note id. Written for the clinician; displayed verbatim. */
  errors: Record<string, string>;
  /** False when the device is offline — recognition runs on the server, so it cannot proceed. */
  isOnline: boolean;
  onConvert: (note: PendingStrokeNote) => void;
  onConvertAll: () => void;
  onOpenSession: (sessionId: string) => void;
}

/**
 * Surfaces handwriting captured but never transcribed — typically written offline, or left behind by
 * a failed conversion — and lets the clinician replay it deliberately.
 *
 * Retry is manual by design, not a background job: the strokes belong to clinical notes, and the
 * clinician should decide when text is appended to them rather than discover it after the fact.
 * Purely props-driven; the container owns every call.
 */
export function PendingStrokesPanel({
  notes, convertingNoteId, isConvertingAll, errors, isOnline,
  onConvert, onConvertAll, onOpenSession,
}: PendingStrokesPanelProps) {
  const isBusy = isConvertingAll || convertingNoteId !== null;

  return (
    <Card className="overflow-hidden border-amber-200 bg-amber-50/40">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <PenLine className="h-4 w-4 text-amber-700" strokeWidth={1.85} />
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-amber-800">
            Tracés en attente de conversion ({notes.length})
          </h2>
        </div>

        {notes.length > 1 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onConvertAll}
            disabled={isBusy || !isOnline}
            loading={isConvertingAll}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Tout convertir
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 p-4">
        <p className="text-[13px] leading-snug text-taupe-600">
          {isOnline
            ? 'Ces séances contiennent une écriture manuscrite qui n’a pas encore été transcrite. La reconnaissance ajoute le texte à la note ; vous pourrez ensuite le relire et le corriger.'
            : 'La reconnaissance nécessite une connexion. Vos tracés sont conservés et resteront disponibles ici jusqu’à leur conversion.'}
        </p>

        <ul className="flex flex-col divide-y divide-amber-200/60">
          {notes.map(note => {
            const isThisConverting = convertingNoteId === note.noteId;
            const error = errors[note.noteId];

            return (
              <li key={note.noteId} className="flex flex-col gap-1.5 py-2.5 first:pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onOpenSession(note.sessionId)}
                      className="truncate text-sm font-medium text-ink underline-offset-2 hover:underline"
                    >
                      {note.sessionTitle || 'Séance sans titre'}
                    </button>
                    <p className="text-xs text-taupe-500">
                      {formatSessionDate(note.sessionDate)}
                      {' · '}
                      {note.strokeCount} tracé{note.strokeCount !== 1 ? 's' : ''}
                    </p>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onConvert(note)}
                    disabled={isBusy || !isOnline}
                  >
                    {isThisConverting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Conversion…
                      </>
                    ) : (
                      'Convertir'
                    )}
                  </Button>
                </div>

                {error && <p className="text-xs leading-snug text-red-600">{error}</p>}
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}
