import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import type { LocalNote, LocalPatientSync } from '../../core/offline/LocalDatabase';
import type { SessionDetailOrigin } from '../../types/navigation';
import {
  getSessionById, getNoteForSession, saveNoteLocally, getAllLocalPatients,
  updateSessionLocally, deleteSessionLocally,
  associateToolToSession, dissociateToolFromSession,
} from './services/localSessionService';
import { ClinicalToolsContainer, getToolsByIds } from '../clinicalTools';
import type { LocalTherapeuticTool } from '../../core/offline/LocalDatabase';
import { runSyncCycle } from '../../core/offline/syncEngine';
import { useNetworkStatus } from '../../core/offline/hooks/useNetworkStatus';
import { HandwritingRecognitionError } from './services/handwritingApiService';
import { convertPendingStrokes } from './services/pendingStrokesService';
import type { Stroke } from './types/handwriting';
import { parsePendingStrokes, serializePendingStrokes } from './utils/pendingStrokes';
import { SessionWorkspace, type InputMode } from './components/SessionWorkspace';
import { SessionEditModal } from './components/SessionEditModal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Drawer } from '../../components/ui/Drawer';


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
  const backLabel = origin?.label ?? 'Mes séances';

  const session = useLiveQuery(
    () => getSessionById(sessionId!),
    [sessionId],
  );
  // Coerce a missing note to `null` so the component can distinguish the two states `useLiveQuery`
  // otherwise collapses into `undefined`: query still loading (`undefined`) vs. confirmed no note
  // exists (`null`). Without this, the auto-create effect below cannot tell them apart and fires
  // during the loading window — inserting a duplicate empty note that shadows the real one.
  const note = useLiveQuery(
    () => getNoteForSession(sessionId!).then(existing => existing ?? null),
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
  const [currentStrokes, setCurrentStrokes] = useState<Stroke[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const autoCreateAttemptedRef = useRef(false);
  // Live pixel dimensions of the writing surface, reported by the canvas. Sent with the strokes so
  // the recognizer is told the real capture area rather than a fixed constant.
  const surfaceSizeRef = useRef({ width: 0, height: 0 });

  // ── Edit / delete state ──────────────────────────────────────────────────
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editPatients, setEditPatients] = useState<LocalPatientSync[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Therapeutic tool association ───────────────────────────────────────────
  // The set of tools linked to this session, derived live from the session row, plus the ids whose
  // toggle is mid-flight (optimistic pending state for the catalog UI).
  const associatedToolIds = useMemo(
    () => new Set(session?.toolIds ?? []),
    [session?.toolIds],
  );
  const [pendingToolIds, setPendingToolIds] = useState<Set<string>>(new Set());

  // Resolve the associated tool ids into records (live) so the persistent workspace sidebar can list
  // their titles. Re-runs when the session's toolIds change or the catalog mirror is (re)hydrated.
  const associatedTools = useLiveQuery(
    () => getToolsByIds(session?.toolIds ?? []),
    [session?.toolIds],
  );

  // The "Mes Outils" catalog is presented on-demand in a side drawer rather than stacked under the
  // note editor, keeping the clinical writing surface uncluttered.
  const [isToolDrawerOpen, setIsToolDrawerOpen] = useState(false);

  async function handleToggleTool(tool: LocalTherapeuticTool): Promise<void> {
    if (!session) return;
    setPendingToolIds(prev => new Set(prev).add(tool.id));
    try {
      if (associatedToolIds.has(tool.id)) {
        await dissociateToolFromSession(session.id, tool.id);
      } else {
        await associateToolToSession(session.id, tool.id);
      }
      runSyncCycle(); // fire-and-forget: push the link change to the server if online
    } finally {
      setPendingToolIds(prev => {
        const next = new Set(prev);
        next.delete(tool.id);
        return next;
      });
    }
  }

  // Direct unlink from the workspace sidebar. Reuses handleToggleTool (the tool is currently
  // associated, so the toggle dissociates it) by resolving the full record from the live list.
  function handleUnlinkTool(toolId: string): void {
    const tool = (associatedTools ?? []).find(t => t.id === toolId);
    if (tool) void handleToggleTool(tool);
  }

  // Auto-create the note record when the session is loaded and no note exists yet.
  // Gate strictly on `note === null` (confirmed absent). While the note query is still loading it is
  // `undefined`, and creating here would race the live query and insert a duplicate empty note that
  // overwrites the real one on the next sync. The ref guard additionally prevents React strict-mode's
  // double-invocation from creating duplicates.
  useEffect(() => {
    if (!session || note !== null || autoCreateAttemptedRef.current) return;
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
    setCurrentStrokes(parsePendingStrokes(note?.unprocessedStrokes).strokes);
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
      // Re-read before writing. `note` was captured when this effect ran; a stroke committed since
      // then has already been persisted, and spreading the stale record would erase it. useLiveQuery
      // does refresh `note`, but asynchronously — the timer can fire first.
      const current = (await getNoteForSession(sessionId!)) ?? note;
      const updated: LocalNote = {
        ...current,
        content: editorText,
        syncStatus: 'pending_update',
        lastModifiedAt: new Date().toISOString(),
      };
      await saveNoteLocally(updated);
      setIsSaving(false);
      runSyncCycle(); // fire-and-forget: attempt immediate sync if online
    }, 1000);
    return () => clearTimeout(timer);
  }, [editorText, note, sessionId]);

  // Persist new strokes to Dexie so they survive a page reload before conversion.
  async function handleStrokesUpdate(newStrokes: Stroke[]): Promise<void> {
    setCurrentStrokes(newStrokes);
    setConversionError(null);
    if (!note) return;
    // Same re-read as the autosave, for the mirror-image reason: a debounced text save may have
    // landed since `note` was rendered, and spreading the stale record would revert it.
    const current = (await getNoteForSession(sessionId!)) ?? note;
    await saveNoteLocally({
      ...current,
      // The capture surface travels with the strokes: a retry launched later from the dashboard has
      // no canvas to ask for it, and the recognizer segments lines against that area.
      unprocessedStrokes: serializePendingStrokes({ strokes: newStrokes, ...surfaceSizeRef.current }),
      syncStatus: 'pending_update',
      lastModifiedAt: new Date().toISOString(),
    });
  }

  function handleSurfaceResize(width: number, height: number): void {
    surfaceSizeRef.current = { width, height };
  }

  async function handleConvertToText(): Promise<void> {
    if (currentStrokes.length === 0 || isConverting || !note) return;
    setIsConverting(true);
    setConversionError(null);
    try {
      // Same service the dashboard retry uses, so there is one conversion path rather than two that
      // can drift. `editorText` is passed as the base because the editor debounces its saves by a
      // second: the stored content can lag what is on screen, and appending to the stored copy would
      // silently drop the last keystrokes.
      const outcome = await convertPendingStrokes(sessionId!, editorText);

      // Nothing legible: keep the strokes so the clinician can retry or rewrite, rather than clearing
      // the canvas and appending an empty paragraph.
      if (outcome.status === 'empty') {
        setConversionError("Aucun texte n'a pu être reconnu dans ce tracé. Vos tracés sont conservés.");
        return;
      }
      if (outcome.status === 'none') return;

      // Mirror the persisted result into the editor. Without this the autosave effect would see
      // `editorText` still holding the pre-conversion text and write it back over the transcription.
      setEditorText(outcome.content);
      setCurrentStrokes([]);
    } catch (error) {
      // Surfaced, never swallowed: a silent failure here is indistinguishable from an inert button.
      // The service writes these messages for the clinician, so they are shown verbatim.
      setConversionError(
        error instanceof HandwritingRecognitionError
          ? error.message
          : 'La reconnaissance a échoué. Vos tracés sont conservés : vous pouvez réessayer.',
      );
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
        <p className="text-sm text-taupe-400">Chargement de la séance…</p>
      </div>
    );
  }

  if (session === null) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-taupe-500">Séance introuvable.</p>
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
        onSurfaceResize={handleSurfaceResize}
        onConvertToText={handleConvertToText}
        isConverting={isConverting}
        conversionError={conversionError}
        isOnline={isOnline}
        canConvert={canConvert}
        onEdit={handleEditOpen}
        onDelete={() => setIsConfirmDeleteOpen(true)}
        onOpenTools={() => setIsToolDrawerOpen(true)}
        onOpenAiReport={() => navigate(`/sessions/${session.id}/report`)}
        associatedTools={(associatedTools ?? []).map(tool => ({
          id: tool.id,
          title: tool.title,
          isPending: pendingToolIds.has(tool.id),
        }))}
        onUnlinkTool={handleUnlinkTool}
      />

      {/* "Mes Outils" scoped to this session, presented on-demand in a side drawer. The catalog
          feature owns the search/display; this container injects the session-side association
          mutation and suppresses the admin curation controls (browse + associate only). */}
      <Drawer
        open={isToolDrawerOpen}
        onClose={() => setIsToolDrawerOpen(false)}
        title="Mes Outils"
      >
        <ClinicalToolsContainer
          hideAdminControls
          isCompactView
          association={{
            associatedToolIds,
            pendingToolIds,
            onToggle: handleToggleTool,
          }}
        />
      </Drawer>

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
        title="Supprimer la séance"
        message="Cette séance et ses notes seront définitivement supprimées. Cette action est irréversible."
        confirmLabel="Supprimer"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsConfirmDeleteOpen(false)}
      />
    </>
  );
}
