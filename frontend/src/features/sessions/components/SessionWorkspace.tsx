import { ArrowLeft, CheckCircle2, Keyboard, Loader2, Pencil, PenLine, Plus, Sparkles, Trash2, WifiOff, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { LocalPatientSync, LocalSession } from '../../../core/offline/LocalDatabase';
import { formatSessionDate } from '../utils/sessionFormatters';
import { HandwritingCanvas } from './HandwritingCanvas';

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
  /** Tools currently associated with this session, rendered in the persistent right sidebar. */
  associatedTools: { id: string; title: string; isPending: boolean }[];
  /** Removes a tool from the active session directly from the sidebar (no drawer round-trip). */
  onUnlinkTool: (toolId: string) => void;
}

export function SessionWorkspace({
  session, backTo, backLabel, patientsById, editorText, onEditorTextChange, isSaving,
  inputMode, onInputModeChange, currentStrokes, onStrokesUpdate,
  onConvertToText, isConverting, isOnline, canConvert, onEdit, onDelete, onOpenTools,
  associatedTools, onUnlinkTool,
}: SessionWorkspaceProps) {
  const convertButtonDisabled = !canConvert;

  return (
    <div className="flex flex-col gap-0 -mx-6 -mt-8 -mb-8 h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="shrink-0 px-6 pt-8 pb-4 border-b border-slate-200 bg-white flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <Link
            to={backTo}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
          <div className="flex flex-col gap-0.5 min-w-0">
            <h1 className="text-lg font-semibold text-slate-900 truncate">{session.title}</h1>
            <p className="text-xs text-slate-400">
              {formatSessionDate(session.date)} · {session.time}
              {session.patientIds.length > 0 && (
                <>
                  {' · '}
                  {session.patientIds.map((patientId, index) => {
                    const patient = patientsById.get(patientId);
                    const patientName = patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown';
                    return (
                      <span key={patientId}>
                        {index > 0 && ', '}
                        {/* Quick access to the patient's file from the session header. */}
                        <Link
                          to={`/patients/${patientId}`}
                          className="text-blue-600 font-medium hover:text-blue-700 hover:underline"
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
        </div>

        <div className="shrink-0 flex items-center gap-3">
          {/* Edit / Delete session */}
          <div className="flex items-center gap-2">
            {/* Discreet, on-demand trigger for the "Mes Outils" drawer. */}
            <button
              type="button"
              onClick={onOpenTools}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter un outil
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>

          {/* Convert to Text button — visible only in stylus mode */}
          {inputMode === 'stylus' && (
            <button
              type="button"
              onClick={onConvertToText}
              disabled={convertButtonDisabled}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                convertButtonDisabled
                  ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed'
                  : 'border-blue-600 text-blue-600 bg-white hover:bg-blue-50'
              }`}
            >
              {isConverting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Converting…
                </>
              ) : !isOnline ? (
                <>
                  <WifiOff className="h-3.5 w-3.5" />
                  Offline
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Convert to Text
                </>
              )}
            </button>
          )}

          {/* Input mode toggle */}
          <div className="flex items-center rounded-md border border-slate-200 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => onInputModeChange('keyboard')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 transition-colors ${
                inputMode === 'keyboard'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Keyboard className="h-3.5 w-3.5" />
              Keyboard
            </button>
            <button
              type="button"
              onClick={() => onInputModeChange('stylus')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 border-l border-slate-200 transition-colors ${
                inputMode === 'stylus'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <PenLine className="h-3.5 w-3.5" />
              Stylus
            </button>
          </div>

          {/* Save indicator */}
          <div className="flex items-center gap-1.5 text-xs">
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 text-slate-400 animate-spin" />
                <span className="text-slate-400">Saving…</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-emerald-600">Saved locally</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Body: note editor on the left, persistent associated-tools sidebar on the right. */}
      <div className="flex flex-1 min-h-0">
        {/* Editor area */}
        <div className="flex flex-1 min-h-0 flex-col">
          {inputMode === 'keyboard' ? (
            <textarea
              value={editorText}
              onChange={e => onEditorTextChange(e.target.value)}
              placeholder="Start typing your session notes here…"
              className="w-full flex-1 min-h-0 resize-none bg-white px-8 py-6 text-base text-slate-800 placeholder:text-slate-300 focus:outline-none leading-relaxed"
              spellCheck
            />
          ) : (
            // Scrollable stylus surface: a tall, auto-growing canvas inside an overflow
            // container. The large bottom padding guarantees blank writing space below the
            // last stroke so the writer is never blocked at the bottom of the viewport.
            <div
              className="flex-1 min-h-0 overflow-y-auto"
              style={{ paddingBottom: '40vh' }}
            >
              {editorText.length > 0 && (
                <pre className="mx-8 mt-6 whitespace-pre-wrap text-base text-slate-800 leading-relaxed font-sans">
                  {editorText}
                </pre>
              )}
              <HandwritingCanvas
                strokes={currentStrokes}
                onStrokesUpdate={onStrokesUpdate}
              />
            </div>
          )}
        </div>

        {/* Persistent associated-tools sidebar. Hidden on narrow viewports to preserve writing space;
            the drawer trigger remains the primary entry point there. */}
        <aside className="hidden lg:flex w-72 shrink-0 flex-col border-l border-slate-200 bg-white">
          <div className="shrink-0 border-b border-slate-200 px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Outils de la séance
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {associatedTools.length === 0 ? (
              <p className="px-1 py-2 text-sm text-slate-400">
                Aucun outil associé à cette séance.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {associatedTools.map(tool => (
                  <li
                    key={tool.id}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">
                      {tool.title}
                    </span>
                    {/* Direct, on-page unlink — no need to reopen the drawer to deselect. */}
                    <button
                      type="button"
                      onClick={() => onUnlinkTool(tool.id)}
                      disabled={tool.isPending}
                      aria-label={`Retirer ${tool.title} de la séance`}
                      title="Retirer de la séance"
                      className="inline-flex shrink-0 items-center justify-center rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-50"
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
        </aside>
      </div>
    </div>
  );
}
