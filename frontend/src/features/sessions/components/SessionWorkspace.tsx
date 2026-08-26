import { ArrowLeft, CheckCircle2, Eraser, Keyboard, Loader2, Maximize2, Minimize2, Pencil, PenLine, Sparkles, Trash2, Undo2, WifiOff, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { LocalPatientSync, LocalSession } from '../../../core/offline/LocalDatabase';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { formatSessionDate } from '../utils/sessionFormatters';
import { HandwritingCanvas } from './HandwritingCanvas';
import { SessionNoteEditor } from './SessionNoteEditor';
import { htmlToPlainText } from '../utils/htmlContent';
import type { Stroke } from '../types/handwriting';

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
  currentStrokes: Stroke[];
  onStrokesUpdate: (strokes: Stroke[]) => void;
  /** Reports the writing surface's pixel dimensions, forwarded to the recognizer with the strokes. */
  onSurfaceResize: (width: number, height: number) => void;
  /** Drops the most recently captured stroke. */
  onUndoStroke: () => void;
  /** Drops every captured stroke (confirmed by the container — the strokes are not recoverable). */
  onClearStrokes: () => void;
  onConvertToText: () => void;
  isConverting: boolean;
  /** Failure (or "nothing recognized") message from the last conversion; null when there is none. */
  conversionError: string | null;
  isOnline: boolean;
  canConvert: boolean;
  /** Whether the writing surface currently covers the viewport. */
  isFullscreen: boolean;
  /** Enters or leaves the distraction-free writing surface. */
  onToggleFullscreen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Opens the on-demand "Mes Outils" side drawer. */
  onOpenTools: () => void;
  /** Navigates to the dedicated AI clinical-report split-screen route for this session. */
  onOpenAiReport: () => void;
  /** How many tools are attached to this session, shown as a badge on the Outils control. */
  associatedToolCount: number;
}

export function SessionWorkspace({
  session, backTo, backLabel, patientsById, editorText, onEditorTextChange, isSaving,
  inputMode, onInputModeChange, currentStrokes, onStrokesUpdate, onSurfaceResize,
  onUndoStroke, onClearStrokes,
  onConvertToText, isConverting, conversionError, isOnline, canConvert,
  isFullscreen, onToggleFullscreen,
  onEdit, onDelete, onOpenTools, onOpenAiReport,
  associatedToolCount,
}: SessionWorkspaceProps) {
  const convertButtonDisabled = !canConvert;

  // Presence guard for the stylus-mode preview: the note is TipTap HTML (an empty doc is "<p></p>"),
  // so test the stripped text to decide whether there is any actual content to render over the canvas.
  const handwritingPreviewText = htmlToPlainText(editorText);

  // Writing controls, rendered identically in the page action bar and in the fullscreen header — the
  // clinician must not have to leave fullscreen to undo a stroke or launch a conversion.
  const editorControls = (
    <>
      {/* Stroke corrections — stylus mode only, and inert while there is nothing captured.
          Recognition consumes every stroke at once, so a mis-drawn one has to be removable
          before conversion rather than after. */}
      {inputMode === 'stylus' && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={onUndoStroke}
            disabled={currentStrokes.length === 0 || isConverting}
            title="Annuler le dernier tracé"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Annuler le tracé
          </Button>
          <Button
            variant="dangerGhost"
            size="sm"
            onClick={onClearStrokes}
            disabled={currentStrokes.length === 0 || isConverting}
            title="Effacer tous les tracés"
          >
            <Eraser className="h-3.5 w-3.5" />
            Tout effacer
          </Button>
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
        </>
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
    </>
  );

  // Everything that scrolls inside the writing area, in whichever container currently holds it.
  const surfaceContent = inputMode === 'keyboard' ? (
    <SessionNoteEditor content={editorText} onChange={onEditorTextChange} />
  ) : (
    <>
      {/* Conversion outcome. Shown above the canvas so it is visible without scrolling, and
          kept until the next stroke or conversion: a failure that says nothing is
          indistinguishable from a button that does nothing. */}
      {conversionError && (
        <p role="status" aria-live="polite" className="mx-3 sm:mx-8 mt-6 text-sm text-red-600">
          {conversionError}
        </p>
      )}
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
        onSurfaceResize={onSurfaceResize}
      />
    </>
  );

  // Blank writing space guaranteed below the last stroke, so the writer is never blocked at the
  // bottom of the viewport. Pointless under the keyboard editor, which has a caret to follow.
  const surfacePadding = inputMode === 'stylus' ? { paddingBottom: '40vh' } : undefined;

  // ── Fullscreen writing surface ─────────────────────────────────────────────
  // Sits at z-40: above the page chrome and the sticky navbar, below the drawer and the dialogs
  // (z-50) so "Mes Outils" and the clear/delete confirmations still open over it.
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-sand-50">
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 bg-white px-4 py-3">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{session.title}</p>
          <div className="flex flex-wrap items-center gap-2">
            {editorControls}
            <Button
              variant="secondary"
              size="sm"
              onClick={onToggleFullscreen}
              title="Quitter le plein écran (Échap)"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              Quitter
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white" style={surfacePadding}>
          {surfaceContent}
        </div>
      </div>
    );
  }

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
          {/* The catalog's only entry point from the workspace: browsing, attaching and detaching
              all happen in the drawer, and each tool's title there opens its own page. */}
          <Button variant="ghost" size="sm" onClick={onOpenTools}>
            <Wrench className="h-3.5 w-3.5" />
            Outils
            {associatedToolCount > 0 && (
              <span className="rounded-full bg-sand-200 px-1.5 text-[11px] font-semibold text-ink">
                {associatedToolCount}
              </span>
            )}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editorControls}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleFullscreen}
            title="Écrire en plein écran"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Plein écran
          </Button>
        </div>
      </div>

      {/* Note editor, full width. The session's tools are reached through the Outils control above,
          which opens the catalog in a side drawer: attaching, detaching and opening a tool's own page
          all happen there, so nothing competes with the writing surface for room on this page. */}
      <Card className="overflow-hidden">
        {inputMode === 'keyboard' ? (
          surfaceContent
        ) : (
          // Scrollable stylus surface: a tall, auto-growing canvas inside an overflow container.
          <div className="min-h-[58vh] max-h-[72vh] overflow-y-auto" style={surfacePadding}>
            {surfaceContent}
          </div>
        )}
      </Card>
    </div>
  );
}
