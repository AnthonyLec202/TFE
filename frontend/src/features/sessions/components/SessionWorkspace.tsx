import { ArrowLeft, CheckCircle2, Keyboard, Loader2, Pencil, PenLine, Sparkles, Trash2, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { LocalSession } from '../../../core/offline/LocalDatabase';
import { formatSessionDate, formatPatientNames } from '../utils/sessionFormatters';
import { HandwritingCanvas } from './HandwritingCanvas';

export type InputMode = 'keyboard' | 'stylus';

export interface SessionWorkspaceProps {
  session: LocalSession;
  patientNamesById: Map<string, string>;
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
}

export function SessionWorkspace({
  session, patientNamesById, editorText, onEditorTextChange, isSaving,
  inputMode, onInputModeChange, currentStrokes, onStrokesUpdate,
  onConvertToText, isConverting, isOnline, canConvert, onEdit, onDelete,
}: SessionWorkspaceProps) {
  const convertButtonDisabled = !canConvert;

  return (
    <div className="flex flex-col gap-0 -mx-6 -mt-8 -mb-8 h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="shrink-0 px-6 pt-8 pb-4 border-b border-slate-200 bg-white flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <Link
            to="/sessions"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            My Sessions
          </Link>
          <div className="flex flex-col gap-0.5 min-w-0">
            <h1 className="text-lg font-semibold text-slate-900 truncate">{session.title}</h1>
            <p className="text-xs text-slate-400">
              {formatSessionDate(session.date)} · {session.time}
              {session.patientIds.length > 0 && (
                <> · {formatPatientNames(session.patientIds, patientNamesById)}</>
              )}
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-3">
          {/* Edit / Delete session */}
          <div className="flex items-center gap-2">
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

      {/* Editor area */}
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
  );
}
