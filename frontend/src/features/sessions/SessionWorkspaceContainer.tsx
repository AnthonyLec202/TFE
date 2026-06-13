import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import type { LocalNote, LocalPatientSync } from '../../core/offline/LocalDatabase';
import type { SessionDetailOrigin } from '../../types/navigation';
import {
  getSessionById, getNoteForSession, saveNoteLocally, getAllLocalPatients,
  updateSessionLocally, deleteSessionLocally,
} from './services/localSessionService';
import { runSyncCycle } from '../../core/offline/syncEngine';
import { useNetworkStatus } from '../../core/offline/hooks/useNetworkStatus';
import { recognizeBatch } from './services/handwritingApiService';
import { SessionWorkspace, type InputMode } from './components/SessionWorkspace';
import { SessionEditModal } from './components/SessionEditModal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

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
  const navigate = useNavigate();
  const location = useLocation();
  const isOnline = useNetworkStatus();

  // Origin is supplied via router state by whichever view opened this session.
  // Fall back to the general Sessions dashboard when navigated to directly
  // (deep link, page reload) or when the state is malformed.
  const origin = location.state as Partial<SessionDetailOrigin> | null;
  const backTo = origin?.from ?? '/sessions';
  const backLabel = origin?.label ?? 'My Sessions';

  const session = useLiveQuery(
    () => getSessionById(sessionId!),
    [sessionId],
  );
  const note = useLiveQuery(
    () => getNoteForSession(sessionId!),
    [sessionId],
  );
  const patients = useLiveQuery(() => getAllLocalPatients());

  const patientsById = useMemo(() => {
    const map = new Map<string, LocalPatientSync>();
    (patients ?? []).forEach(p => map.set(p.id, p));
    return map;
  }, [patients]);

  const [editorText, setEditorText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('keyboard');
  const [currentStrokes, setCurrentStrokes] = useState<any[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const autoCreateAttemptedRef = useRef(false);

  // ── Edit / delete state ──────────────────────────────────────────────────
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editPatients, setEditPatients] = useState<LocalPatientSync[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // ── Edit / delete handlers ─────────────────────────────────────────────────

  function handleEditOpen(): void {
    if (!session) return;
    setEditTitle(session.title);
    setEditDate(session.date);
    setEditTime(session.time);
    setEditPatients((patients ?? []).filter(p => session.patientIds.includes(p.id)));
    setIsEditOpen(true);
  }

  async function handleEditSubmit(): Promise<void> {
    if (!session) return;
    setIsSavingEdit(true);
    try {
      await updateSessionLocally(session.id, {
        title: editTitle.trim(),
        date: editDate,
        time: editTime,
        patientIds: editPatients.map(p => p.id),
      });
      runSyncCycle(); // fire-and-forget: push the update to the server if online
      setIsEditOpen(false);
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!session) return;
    setIsDeleting(true);
    try {
      await deleteSessionLocally(session.id);
      runSyncCycle(); // fire-and-forget: issue the server-side DELETE if online
      // Workspace state is discarded on unmount; return to wherever the user came from.
      navigate(backTo);
    } finally {
      setIsDeleting(false);
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
    <>
      <SessionWorkspace
        session={session}
        backTo={backTo}
        backLabel={backLabel}
        patientsById={patientsById}
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
        onEdit={handleEditOpen}
        onDelete={() => setIsConfirmDeleteOpen(true)}
      />

      {isEditOpen && (
        <SessionEditModal
          title={editTitle}
          date={editDate}
          time={editTime}
          selectedPatients={editPatients}
          saving={isSavingEdit}
          onTitleChange={setEditTitle}
          onDateChange={setEditDate}
          onTimeChange={setEditTime}
          onPatientsChange={setEditPatients}
          onSubmit={handleEditSubmit}
          onClose={() => setIsEditOpen(false)}
        />
      )}

      <ConfirmDialog
        open={isConfirmDeleteOpen}
        title="Delete session"
        message="This session and its notes will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsConfirmDeleteOpen(false)}
      />
    </>
  );
}
