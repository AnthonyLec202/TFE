import { CheckCircle2, Keyboard, Loader2, PenLine, Sparkles, WifiOff } from 'lucide-react';
import type { LocalSession } from '../../../core/offline/LocalDatabase';
import { HandwritingCanvas } from './HandwritingCanvas';

export type InputMode = 'keyboard' | 'stylus';

export interface SessionWorkspaceProps {
  session: LocalSession;
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
}

export function SessionWorkspace({
  session, editorText, onEditorTextChange, isSaving,
  inputMode, onInputModeChange, currentStrokes, onStrokesUpdate,
  onConvertToText, isConverting, isOnline, canConvert,
}: SessionWorkspaceProps) {
  const convertButtonDisabled = !canConvert;

  return (
    <div className="flex flex-col gap-0 -mx-6 -mt-8">
      {/* Header */}
      <div className="px-6 pt-8 pb-4 border-b border-slate-200 bg-white flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h1 className="text-lg font-semibold text-slate-900 truncate">{session.title}</h1>
          <p className="text-xs text-slate-400">
            {session.date} · {session.time}
            {session.patientIds.length > 0 && (
              <> · {session.patientIds.length} patient{session.patientIds.length !== 1 ? 's' : ''}</>
            )}
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-3">
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
          className="w-full flex-1 min-h-[calc(100vh-12rem)] resize-none bg-white px-8 py-6 text-base text-slate-800 placeholder:text-slate-300 focus:outline-none leading-relaxed"
          spellCheck
        />
      ) : (
        <div className="flex flex-col">
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
