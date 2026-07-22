import { useState } from 'react';
import { ArrowLeft, Edit, FileText, Loader2, Printer, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { formatSessionDate } from '../utils/sessionFormatters';

// DOM ids of the exportable content containers, targeted by the PDF generator.
const REPORT_CONTENT_ELEMENT_ID = 'ai-report-content';
const NOTES_CONTENT_ELEMENT_ID = 'session-notes-content';

// Which column a print/export targets: the raw notes, the AI report, or nothing (idle).
type ExportTarget = 'notes' | 'report';

export interface AiReportWorkspaceProps {
  /** Session id, used to name the exported PDF file. */
  sessionId: string;
  /** Session date (ISO string) shown in the read-only context sub-header. */
  sessionDate: string;
  /** Read-only note content rendered in the left context column. */
  noteContent: string;
  /** Existing AI report to hydrate the UI with (e.g. a previously validated report); null if none. */
  initialReport: string | null;
  /** Whether the existing report was already validated — initializes the UI directly in Phase 4. */
  initialValidated: boolean;
  /** Whether the current user (administrator) may re-run AI generation over an existing report. */
  canRegenerate: boolean;
  /** Returns to the session workspace. */
  onBack: () => void;
  /** Generates a report from the session notes on the backend; resolves to the Markdown string. */
  onGenerate: () => Promise<string>;
  /** Persists the validated report (Dexie + sync). */
  onSave: (reportContent: string) => Promise<void>;
}

// Presentational split-screen for AI clinical-report generation.
// Left column: read-only session-note context. Right column: a four-phase UI state machine
// (empty -> loading -> draft/edit -> validated/read-only). Generation and persistence are delegated
// to the container via onGenerate/onSave; the phase transitions are driven by local state. An
// administrator (canRegenerate) can re-run generation from the draft or validated phase, looping back
// through loading into a fresh, unvalidated draft built from the latest notes.
export function AiReportWorkspace({
  sessionId, sessionDate, noteContent, initialReport, initialValidated, canRegenerate, onBack, onGenerate, onSave,
}: AiReportWorkspaceProps) {
  const [reportContent, setReportContent] = useState<string | null>(initialReport);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isValidated, setIsValidated] = useState(initialValidated);
  const [isSaving, setIsSaving] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  // Gates the "Sauvegarder" action. Kept separate from `isValidated` so the draft phase persists
  // while the clinician ticks the acknowledgement — only clicking "Sauvegarder" commits to Phase 4.
  // Pre-checked when arriving on an already-validated report so editing then re-saving is frictionless.
  const [isAcknowledged, setIsAcknowledged] = useState(initialValidated);

  // Phase 1/3/4 -> 2 -> 3: call the backend generator, then drop into the editable draft. Used for both
  // the initial generation and an administrator re-generation: on success it always resets to an
  // unvalidated, unacknowledged draft so the clinician re-reviews the freshly produced content. On
  // failure the previous state (including an existing validated report) is preserved untouched.
  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const report = await onGenerate();
      setReportContent(report);
      setIsValidated(false);
      setIsAcknowledged(false);
    } catch {
      setGenerationError('La génération du compte rendu a échoué. Vérifiez votre connexion et réessayez.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Phase 3 -> 4: persist the validated report through the container, then lock to read-only.
  const handleSave = async () => {
    if (reportContent === null) return;
    setIsSaving(true);
    try {
      await onSave(reportContent);
      setIsValidated(true);
    } finally {
      setIsSaving(false);
    }
  };

  // Native print of a single column. The target is written synchronously to a body data attribute the
  // print: classes key off, so there is no async state round-trip (and no race) before window.print().
  // window.print() blocks until the dialog closes, after which the attribute is removed.
  const handlePrint = (target: ExportTarget) => {
    document.body.setAttribute('data-print', target);
    window.print();
    document.body.removeAttribute('data-print');
  };

  // Client-side PDF export of a single column. Rather than rasterizing the on-screen element (which
  // carries the app's sand background/shadows) or a manually-mounted node (which html2canvas culls out
  // of the live React layout), we hand html2pdf a raw HTML string: it renders that in an isolated,
  // hidden iframe, guaranteeing correct bounding boxes free of viewport interference. html2pdf is
  // imported dynamically so its (canvas/jsPDF) bundle only loads when the clinician actually exports.
  const handleExportPdf = async (target: ExportTarget) => {
    const sourceId = target === 'report' ? REPORT_CONTENT_ELEMENT_ID : NOTES_CONTENT_ELEMENT_ID;
    const source = document.getElementById(sourceId);
    if (!source) return;

    // Report content is preformatted text; preserve wrapping. Notes are already structured HTML.
    // overflow-wrap/word-break force long tokens to wrap so nothing overflows the page width.
    const contentStyle = target === 'report'
      ? 'white-space: pre-wrap; overflow-wrap: break-word; word-break: break-word; line-height: 1.6;'
      : 'overflow-wrap: break-word; word-break: break-word; line-height: 1.6;';

    // Visual highlights are deliberately NOT rendered in the PDF (html2canvas mis-rasterizes inline
    // <mark> fills). We unwrap every inline formatting tag so its text survives but the tag is
    // destroyed, while structural block tags (<p>, <ul>, <li>, <br>) are preserved for layout. The
    // styling intent still lives in the database notes, which the AI backend consumes.
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = source.innerHTML;

    const tagsToStrip = tempDiv.querySelectorAll('mark, strong, em, u');
    tagsToStrip.forEach(el => {
      const parent = el.parentNode;
      while (el.firstChild) {
        parent?.insertBefore(el.firstChild, el);
      }
      parent?.removeChild(el);
    });

    const cleanHtml = tempDiv.innerHTML;

    // border-box width sized to A4's printable area (210mm − 2×10mm margin ≈ 718px at 96dpi). Keeping
    // the total element width within the page prevents html2pdf from clipping the right edge.
    const printableHtml =
      '<div style="box-sizing: border-box; width: 700px; background: white; color: black; padding: 40px; font-family: sans-serif; overflow-wrap: break-word; word-wrap: break-word;">' +
      `<h2 style="font-size: 22px; font-weight: bold; margin-bottom: 16px;">Séance du ${formatSessionDate(sessionDate)}</h2>` +
      `<div style="${contentStyle}">${cleanHtml}</div>` +
      '</div>';

    const filename = target === 'report'
      ? `Compte_Rendu_Session_${sessionId}.pdf`
      : `Notes_Session_${sessionId}.pdf`;

    const { default: html2pdf } = await import('html2pdf.js');
    await html2pdf()
      .set({
        filename,
        margin: 10,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(printableHtml)
      .save();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Back navigation — irrelevant on paper. */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-taupe-500 transition-colors hover:text-ink print:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à la séance
      </button>

      <div className="flex items-center gap-2 print:hidden">
        <Sparkles className="h-5 w-5 text-petrol-600" strokeWidth={1.85} />
        <h1 className="font-serif font-semibold text-[clamp(1.375rem,3.5vw,1.625rem)] leading-tight tracking-[-0.015em] text-ink print:hidden">
          Compte rendu IA
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start print:block">
        {/* Left column: read-only session-note context. Printed/exported only when the user targets
            the notes; otherwise hidden so the AI report prints alone. */}
        <Card
          className="flex flex-col overflow-hidden print:border-none print:shadow-none print:overflow-visible print:bg-white print:hidden [body[data-print=notes]_&]:print:block [body[data-print=notes]_&]:print:w-full"
        >
          <div className="shrink-0 border-b border-sand-200 px-4 py-3 print:hidden">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-taupe-500">
              Notes de la séance du {formatSessionDate(sessionDate)}
            </h2>
          </div>
          <div className="p-4">
            {/* Print/export-only document header. */}
            <h2 className="hidden print:block text-2xl font-bold mb-4">
              Séance du {formatSessionDate(sessionDate)}
            </h2>

            <div id={NOTES_CONTENT_ELEMENT_ID}>
              {noteContent.trim().length > 0 ? (
                // The note is TipTap-authored HTML (schema-constrained: p/strong/em/mark/lists…), shown
                // read-only here. Arbitrary variants render the <mark> fluo, bold and lists natively.
                <div
                  className="text-sm leading-relaxed text-ink [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_mark]:bg-[#FCEAA8] [&_mark]:rounded-sm [&_mark]:px-0.5"
                  dangerouslySetInnerHTML={{ __html: noteContent }}
                />
              ) : (
                <p className="text-sm text-taupe-400">Aucune note saisie pour cette séance.</p>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 print:hidden">
              <Button variant="secondary" size="sm" onClick={() => handlePrint('notes')}>
                <Printer className="h-3.5 w-3.5" />
                Imprimer
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleExportPdf('notes')}>
                <FileText className="h-3.5 w-3.5" />
                Exporter PDF
              </Button>
            </div>
          </div>
        </Card>

        {/* Right column: AI generation state machine. Printed/exported only when the user targets the
            report; strips its card chrome for a clean document. */}
        <Card
          className="flex flex-col overflow-hidden print:border-none print:shadow-none print:overflow-visible print:bg-white print:hidden [body[data-print=report]_&]:print:block [body[data-print=report]_&]:print:w-full"
        >
          <div className="shrink-0 border-b border-sand-200 px-4 py-3 print:hidden">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-taupe-500">
              Génération du compte rendu
            </h2>
          </div>

          <div className="flex flex-col gap-4 p-4">
            {/* Print/export-only document header. */}
            <h2 className="hidden print:block text-2xl font-bold mb-4">
              Séance du {formatSessionDate(sessionDate)}
            </h2>

            {/* Generation error, surfaced above every phase so a failed (re)generation stays visible —
                including when an already-validated report is still displayed below. */}
            {generationError && (
              <p className="text-sm text-red-600 print:hidden">{generationError}</p>
            )}

            {/* Phase 1: Empty */}
            {reportContent === null && !isGenerating && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-taupe-500">
                  Générez un brouillon de compte rendu clinique à partir des notes de la séance.
                </p>
                <Button variant="primary" size="md" onClick={handleGenerate}>
                  🤖 Générer le compte rendu
                </Button>
              </div>
            )}

            {/* Phase 2: Loading */}
            {isGenerating && (
              <Button variant="primary" size="md" disabled>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyse clinique en cours...
              </Button>
            )}

            {/* Phase 3: Draft / Edit mode */}
            {reportContent !== null && !isValidated && !isGenerating && (
              <div className="flex flex-col gap-3">
                <textarea
                  value={reportContent}
                  onChange={e => setReportContent(e.target.value)}
                  className="w-full min-h-[48vh] resize-y rounded-xl border border-sand-300 bg-white px-3.5 py-3 text-sm leading-relaxed text-ink placeholder:text-taupe-400 transition-colors focus:outline-none focus:ring-2 focus:ring-petrol-600 focus:border-transparent"
                  spellCheck
                />

                <label className="flex items-start gap-2 text-[13px] leading-snug text-taupe-600">
                  <input
                    type="checkbox"
                    checked={isAcknowledged}
                    onChange={e => setIsAcknowledged(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-petrol-600"
                  />
                  <span>
                    J'ai relu, corrigé et je valide ce compte rendu sous ma responsabilité de clinicien.
                  </span>
                </label>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="md"
                    disabled={!isAcknowledged || isSaving}
                    loading={isSaving}
                    onClick={handleSave}
                  >
                    Sauvegarder
                  </Button>
                  {/* Admin-only: discard this draft and re-run generation from the latest notes. */}
                  {canRegenerate && (
                    <Button variant="secondary" size="md" onClick={handleGenerate}>
                      <RefreshCw className="h-4 w-4" />
                      Régénérer
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Phase 4: Validated (read-only). `!isGenerating` so a re-generation falls through to the
                loading phase instead of rendering the stale validated report alongside the spinner. */}
            {isValidated && reportContent !== null && !isGenerating && (
              <div className="flex flex-col gap-3">
                <pre
                  id={REPORT_CONTENT_ELEMENT_ID}
                  className="whitespace-pre-wrap break-words rounded-xl border border-sand-200 bg-sand-50 px-3.5 py-3 text-sm leading-relaxed text-ink font-sans print:rounded-none print:border-none print:bg-white print:p-0"
                >
                  {reportContent}
                </pre>

                <div className="flex flex-wrap gap-2 print:hidden">
                  <Button variant="secondary" size="sm" onClick={() => handlePrint('report')}>
                    <Printer className="h-3.5 w-3.5" />
                    Imprimer
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleExportPdf('report')}>
                    <FileText className="h-3.5 w-3.5" />
                    Exporter PDF
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setIsValidated(false)}>
                    <Edit className="h-3.5 w-3.5" />
                    Modifier
                  </Button>
                  {/* Admin-only: re-run AI generation from the latest notes, replacing this report. */}
                  {canRegenerate && (
                    <Button variant="secondary" size="sm" onClick={handleGenerate}>
                      <RefreshCw className="h-3.5 w-3.5" />
                      Régénérer
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
