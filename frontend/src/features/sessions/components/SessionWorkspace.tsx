import { ArrowLeft, CheckCircle2, Keyboard, Loader2, Pencil, PenLine, Plus, Sparkles, Trash2, WifiOff, X, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { LocalPatientSync, LocalSession } from '../../../core/offline/LocalDatabase';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { formatSessionDate } from '../utils/sessionFormatters';
import { HandwritingCanvas } from './HandwritingCanvas';
import { SessionNoteEditor } from './SessionNoteEditor';
import { htmlToPlainText } from '../utils/htmlContent';

export type InputMode = 'keyboard' | 'stylus';

export interface SessionWorkspaceProps {
  session: LocalSession;
  /** Route the Back button returns to. */
  backTo: string;
  /** Label shown on the Back button. */
  backLabel: string;
  /** Lookup of every locally-known patient by id, used to render clickable patient links. */
  patientsById: Map<string, LocalPatientSync>;
  editorText: string;
  onEditorTextChange: (text: string) => void;
  isSaving: boolean;
  inputMode: InputMode;
  onInputModeChange: (mode: InputMode) => void;
  currentStrokes: any[];
  onStrokesUpdate: (strokes: any[]) => void;
  onConvertToText: () => void;
  isConverting: boolean;
  isOnline: boolean;
  canConvert: boolean;
  onEdit: () => void;
  onDelete: () => void;
  /** Opens the on-demand "Mes Outils" side drawer. */
  onOpenTools: () => void;
  /** Navigates to the dedicated AI clinical-report split-screen route for this session. */
  onOpenAiReport: () => void;
  /** Tools currently associated with this session, rendered in the persistent right sidebar. */
  associatedTools: { id: string; title: string; isPending: boolean }[];
  /** Removes a tool from the active session directly from the sidebar (no drawer round-trip). */
  onUnlinkTool: (toolId: string) => void;
}

export function SessionWorkspace({
  session, backTo, backLabel, patientsById, editorText, onEditorTextChange, isSaving,
  inputMode, onInputModeChange, currentStrokes, onStrokesUpdate,
  onConvertToText, isConverting, isOnline, canConvert, onEdit, onDelete, onOpenTools, onOpenAiReport,
  associatedTools, onUnlinkTool,
}: SessionWorkspaceProps) {
  const convertButtonDisabled = !canConvert;

  // Presence guard for the stylus-mode preview: the note is TipTap HTML (an empty doc is "<p></p>"),
  // so test the stripped text to decide whether there is any actual content to render over the canvas.
  const handwritingPreviewText = htmlToPlainText(editorText);

  return (
    <div className="flex flex-col gap-6">
      {/* Back */}
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 text-sm text-taupe-500 hover:text-ink w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>

      {/* Page header: title + meta on the left, save status pill on the right. */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="font-serif font-semibold text-[clamp(1.375rem,3.5vw,1.625rem)] leading-tight tracking-[-0.015em] text-ink break-words">
            {session.title}
          </h1>
          <p className="text-[14.5px] text-taupe-500">
            {formatSessionDate(session.date)} · {session.time}
            {session.patientIds.length > 0 && (
              <>
                {' · '}
                {session.patientIds.map((patientId, index) => {
                  const patient = patientsById.get(patientId);
                  const patientName = patient ? `${patient.firstName} ${patient.lastName}` : 'Inconnu';
                  return (
                    <span key={patientId}>
                      {index > 0 && ', '}
                      {/* Quick access to the patient's file from the session header. */}
                      <Link
                        to={`/patients/${patientId}`}
                        className="text-petrol-600 font-medium hover:text-petrol-700 hover:underline"
                      >
                        {patientName}
                      </Link>
                    </span>
                  );
                })}
              </>
            )}
          </p>
        </div>

        {/* Save indicator — status pill, consistent with the dashboard's SyncBadge. */}
        <div className="shrink-0">
          {isSaving ? (
            <span className="flex items-center gap-1.5 text-[12.5px] text-taupe-500 bg-sand-100 border border-sand-200 px-3 py-1.5 rounded-full">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Enregistrement…
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[12.5px] px-3 py-1.5 rounded-full text-[#2F7D5B] bg-[#E6F0EA] border border-[#CADDD0]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Enregistré localement
            </span>
          )}
        </div>
      </div>

      {/* Action bar: document actions on the left, editor controls on the right. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
            Modifier
          </Button>
          <Button variant="dangerGhost" size="sm" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer
          </Button>
          <Button variant="ghost" size="sm" onClick={onOpenAiReport}>
            <Sparkles className="h-3.5 w-3.5" />
            Compte Rendu IA
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Convert to Text button — visible only in stylus mode */}
          {inputMode === 'stylus' && (
            <Button
              variant="primary"
              size="sm"
              onClick={onConvertToText}
              disabled={convertButtonDisabled}
            >
              {isConverting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Conversion…
                </>
              ) : !isOnline ? (
                <>
                  <WifiOff className="h-3.5 w-3.5" />
                  Hors ligne
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Convertir en texte
                </>
              )}
            </Button>
          )}

          {/* Input mode toggle — segmented control, active state in petrol. */}
          <div className="flex items-center rounded-lg border border-sand-300 bg-white overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => onInputModeChange('keyboard')}
              className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${
                inputMode === 'keyboard'
                  ? 'bg-petrol-600 text-white'
                  : 'text-taupe-500 hover:text-ink hover:bg-sand-50'
              }`}
            >
              <Keyboard className="h-3.5 w-3.5" />
              Clavier
            </button>
            <button
              type="button"
              onClick={() => onInputModeChange('stylus')}
              className={`flex items-center gap-1.5 px-3 py-2 border-l border-sand-300 transition-colors ${
                inputMode === 'stylus'
                  ? 'bg-petrol-600 text-white'
                  : 'text-taupe-500 hover:text-ink hover:bg-sand-50'
              }`}
            >
              <PenLine className="h-3.5 w-3.5" />
              Stylet
            </button>
          </div>
        </div>
      </div>

      {/* Body: note editor on the left, persistent associated-tools sidebar on the right. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
        {/* Editor card */}
        <Card className="overflow-hidden">
          {inputMode === 'keyboard' ? (
            <SessionNoteEditor content={editorText} onChange={onEditorTextChange} />
          ) : (
            // Scrollable stylus surface: a tall, auto-growing canvas inside an overflow
            // container. The large bottom padding guarantees blank writing space below the
            // last stroke so the writer is never blocked at the bottom of the viewport.
            <div
              className="min-h-[58vh] max-h-[72vh] overflow-y-auto"
              style={{ paddingBottom: '40vh' }}
            >
              {handwritingPreviewText.trim().length > 0 && (
                // Render the existing note as rich HTML (bold/italic/<mark>) for visual parity with the
                // keyboard editor. Content is TipTap-authored, schema-constrained HTML.
                <div
                  className="session-note-stylus-preview mx-7 mt-6 text-base text-ink"
                  dangerouslySetInnerHTML={{ __html: editorText }}
                />
              )}
              <HandwritingCanvas
                strokes={currentStrokes}
                onStrokesUpdate={onStrokesUpdate}
              />
            </div>
          )}
        </Card>

        {/* Persistent associated-tools sidebar. Hidden on narrow viewports to preserve writing space;
            the drawer trigger remains the primary entry point there. */}
        <Card className="hidden lg:flex flex-col overflow-hidden">
          <div className="shrink-0 flex items-center justify-between border-b border-sand-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <Wrench className="h-3.5 w-3.5 text-petrol-600" strokeWidth={1.85} />
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-taupe-500">
                Outils de la séance
              </h2>
            </div>
            <Button variant="secondary" size="sm" onClick={onOpenTools}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="p-3">
            {associatedTools.length === 0 ? (
              <p className="px-1 py-2 text-sm text-taupe-400">
                Aucun outil associé à cette séance.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {associatedTools.map(tool => (
                  <li
                    key={tool.id}
                    className="flex items-center gap-2 rounded-lg border border-sand-200 bg-sand-50 px-3 py-2"
                  >
                    {/* Open the tool's detail view, carrying the originating session id in router
                        state so the detail view can offer a "back to session" return path. */}
                    <Link
                      to={`/clinical-tools/${tool.id}`}
                      state={{ fromSessionId: session.id }}
                      className="min-w-0 flex-1 truncate text-sm font-medium text-ink transition-colors hover:text-petrol-600 hover:underline"
                    >
                      {tool.title}
                    </Link>
                    {/* Direct, on-page unlink — no need to reopen the drawer to deselect. */}
                    <button
                      type="button"
                      onClick={() => onUnlinkTool(tool.id)}
                      disabled={tool.isPending}
                      aria-label={`Retirer ${tool.title} de la séance`}
                      title="Retirer de la séance"
                      className="inline-flex shrink-0 items-center justify-center rounded-md p-1 text-taupe-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-50"
                    >
                      {tool.isPending
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <X className="h-3.5 w-3.5" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
