import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import type { LocalNote } from '../../core/offline/LocalDatabase';
import { getSessionById, getNoteForSession, saveNoteLocally } from './services/localSessionService';
import { runSyncCycle } from '../../core/offline/syncEngine';
import { useNetworkStatus } from '../../core/offline/hooks/useNetworkStatus';
import { recognizeBatch } from './services/handwritingApiService';
import { SessionWorkspace, type InputMode } from './components/SessionWorkspace';

function parseStrokes(raw: string | undefined): any[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function SessionWorkspaceContainer() {
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

  if (session === null) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-red-400">Session not found.</p>
      </div>
    );
  }

  // ── Workspace ──────────────────────────────────────────────────────────────

  const canConvert = isOnline && currentStrokes.length > 0 && !isConverting;

  return (
    <SessionWorkspace
      session={session}
      editorText={editorText}
      onEditorTextChange={setEditorText}
      isSaving={isSaving}
      inputMode={inputMode}
      onInputModeChange={setInputMode}
      currentStrokes={currentStrokes}
      onStrokesUpdate={handleStrokesUpdate}
      onConvertToText={handleConvertToText}
      isConverting={isConverting}
      isOnline={isOnline}
      canConvert={canConvert}
    />
  );
}
