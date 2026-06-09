import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, Keyboard, Loader2, PenLine, Sparkles, WifiOff } from 'lucide-react';
import type { LocalNote } from '../../../core/offline/LocalDatabase';
import { getSessionById, getNoteForSession, saveNoteLocally } from '../services/localSessionService';
import { runSyncCycle } from '../../../core/offline/syncEngine';
import { useNetworkStatus } from '../../../core/offline/hooks/useNetworkStatus';
import { recognizeBatch } from '../services/handwritingApiService';
import { HandwritingCanvas } from './HandwritingCanvas';

type InputMode = 'keyboard' | 'stylus';

function parseStrokes(raw: string | undefined): any[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function SessionWorkspace() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const isOnline = useNetworkStatus();

  const session = useLiveQuery(
    () => getSessionById(sessionId!),
    [sessionId],
  );
  const note = useLiveQuery(
    () => getNoteForSession(sessionId!),
    [sessionId],
  );

  const [editorText, setEditorText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('keyboard');
  const [currentStrokes, setCurrentStrokes] = useState<any[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const autoCreateAttemptedRef = useRef(false);

  // Auto-create the note record when the session is loaded and no note exists yet.
  // The ref guard prevents React strict-mode's double-invocation from creating duplicates.
  useEffect(() => {
    if (!session || note !== undefined || autoCreateAttemptedRef.current) return;
    autoCreateAttemptedRef.current = true;

    const newNote: LocalNote = {
      id: crypto.randomUUID(),
      sessionId: sessionId!,
      content: '',
      syncStatus: 'pending_create',
      lastModifiedAt: new Date().toISOString(),
    };
    saveNoteLocally(newNote);
  }, [session, note, sessionId]);

  // Reset all editor state when navigating to a different session.
  // Keyed on note identity to avoid overwriting in-progress edits on the same session.
  useEffect(() => {
    setEditorText(note?.content ?? '');
    setCurrentStrokes(parseStrokes(note?.unprocessedStrokes));
    setIsSaving(false);
    autoCreateAttemptedRef.current = false;
  }, [note?.id]);

  // Debounced autosave: persist text content to IndexedDB 1 s after the user stops typing.
  useEffect(() => {
    if (!note || editorText === (note.content ?? '')) {
      setIsSaving(false);
      return;
    }
    setIsSaving(true);
    const timer = setTimeout(async () => {
      const updated: LocalNote = {
        ...note,
        content: editorText,
        syncStatus: 'pending_update',
        lastModifiedAt: new Date().toISOString(),
      };
      await saveNoteLocally(updated);
      setIsSaving(false);
      runSyncCycle(); // fire-and-forget: attempt immediate sync if online
    }, 1000);
    return () => clearTimeout(timer);
  }, [editorText, note]);

  // Append recognised handwriting to the current editor content.
  function handleTextRecognized(recognizedText: string): void {
    setEditorText(prev => (prev.length > 0 ? `${prev} ${recognizedText}` : recognizedText));
  }

  // Persist new strokes to Dexie so they survive a page reload before conversion.
  function handleStrokesUpdate(newStrokes: any[]): void {
    setCurrentStrokes(newStrokes);
    if (!note) return;
    saveNoteLocally({
      ...note,
      unprocessedStrokes: JSON.stringify(newStrokes),
      syncStatus: 'pending_update',
      lastModifiedAt: new Date().toISOString(),
    });
  }

  async function handleConvertToText(): Promise<void> {
    if (!isOnline || currentStrokes.length === 0 || isConverting || !note) return;
    setIsConverting(true);
    try {
      const result = await recognizeBatch(JSON.stringify(currentStrokes));
      handleTextRecognized(result);
      // Clear strokes both in state and in Dexie atomically.
      setCurrentStrokes([]);
      saveNoteLocally({
        ...note,
        unprocessedStrokes: '[]',
        syncStatus: 'pending_update',
        lastModifiedAt: new Date().toISOString(),
      });
    } catch {
      // Conversion failed silently — strokes remain so the user can retry.
    } finally {
      setIsConverting(false);
    }
  }

  // ── Loading / not-found states ─────────────────────────────────────────────

  if (session === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-slate-400">Loading session…</p>
      </div>
    );
  }

  if (session === null || (session === undefined && sessionId)) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-red-400">Session not found.</p>
      </div>
    );
  }

  // ── Derived button state ───────────────────────────────────────────────────

  const canConvert = isOnline && currentStrokes.length > 0 && !isConverting;
  const convertButtonDisabled = !canConvert;

  // ── Workspace ──────────────────────────────────────────────────────────────

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
              onClick={handleConvertToText}
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
              onClick={() => setInputMode('keyboard')}
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
              onClick={() => setInputMode('stylus')}
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
          onChange={e => setEditorText(e.target.value)}
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
            onStrokesUpdate={handleStrokesUpdate}
          />
        </div>
      )}
    </div>
  );
}
