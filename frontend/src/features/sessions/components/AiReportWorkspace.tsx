import { useState } from 'react';
import { ArrowLeft, FileText, Loader2, Pencil, Printer, Sparkles } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { formatSessionDate } from '../utils/sessionFormatters';

// Simulated latency for the mock generation call, matching the eventual backend round-trip feel.
const MOCK_GENERATION_DELAY_MS = 2000;

// Placeholder clinical summary returned by the mock generator. Replaced by a real backend response
// in a later step — for now it exercises the full draft/validate/read-only UI flow.
const MOCK_REPORT_CONTENT = `# Compte rendu de séance

## Synthèse clinique
Le patient se présente avec une humeur stable et une bonne implication dans les exercices proposés.

## Observations
- Engagement actif durant la séance.
- Progression notable sur les objectifs fixés précédemment.
- Aucune difficulté majeure relevée.

## Objectifs pour la prochaine séance
1. Poursuivre le travail sur la régulation émotionnelle.
2. Introduire de nouveaux outils de gestion du stress.

*Ce compte rendu a été généré automatiquement et doit être relu et validé par le clinicien.*`;

export interface AiReportWorkspaceProps {
  /** Session date (ISO string) shown in the read-only context sub-header. */
  sessionDate: string;
  /** Read-only note content rendered in the left context column. */
  noteContent: string;
  /** Returns to the session workspace. */
  onBack: () => void;
}

// Presentational split-screen for AI clinical-report generation.
// Left column: read-only session-note context. Right column: a self-contained four-phase UI state
// machine (empty -> loading -> draft/edit -> validated/read-only) driven entirely by local state.
// No backend, database, or offline persistence is wired up at this stage.
export function AiReportWorkspace({ sessionDate, noteContent, onBack }: AiReportWorkspaceProps) {
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  // Gates the "Sauvegarder" action. Kept separate from `isValidated` so the draft phase persists
  // while the clinician ticks the acknowledgement — only clicking "Sauvegarder" commits to Phase 4.
  const [isAcknowledged, setIsAcknowledged] = useState(false);

  // Phase 1 -> 2 -> 3: mock the asynchronous generation, then drop into the editable draft.
  const handleGenerateMock = async () => {
    setIsGenerating(true);
    await new Promise(resolve => setTimeout(resolve, MOCK_GENERATION_DELAY_MS));
    setReportContent(MOCK_REPORT_CONTENT);
    setIsGenerating(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Back navigation */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-taupe-500 transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à la séance
      </button>

      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-petrol-600" strokeWidth={1.85} />
        <h1 className="font-serif font-semibold text-[26px] leading-tight tracking-[-0.015em] text-ink">
          Compte rendu IA
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left column: read-only session-note context. */}
        <Card className="flex flex-col overflow-hidden">
          <div className="shrink-0 border-b border-sand-200 px-4 py-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-taupe-500">
              Notes de la séance du {formatSessionDate(sessionDate)}
            </h2>
          </div>
          <div className="p-4">
            {noteContent.length > 0 ? (
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-ink font-sans">
                {noteContent}
              </pre>
            ) : (
              <p className="text-sm text-taupe-400">Aucune note saisie pour cette séance.</p>
            )}
          </div>
        </Card>

        {/* Right column: AI generation state machine. */}
        <Card className="flex flex-col overflow-hidden">
          <div className="shrink-0 border-b border-sand-200 px-4 py-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-taupe-500">
              Génération du compte rendu
            </h2>
          </div>

          <div className="flex flex-col gap-4 p-4">
            {/* Phase 1: Empty */}
            {reportContent === null && !isGenerating && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-taupe-500">
                  Générez un brouillon de compte rendu clinique à partir des notes de la séance.
                </p>
                <Button variant="primary" size="md" onClick={handleGenerateMock}>
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

                <Button
                  variant="primary"
                  size="md"
                  disabled={!isAcknowledged}
                  onClick={() => setIsValidated(true)}
                >
                  Sauvegarder
                </Button>
              </div>
            )}

            {/* Phase 4: Validated (read-only) */}
            {isValidated && reportContent !== null && (
              <div className="flex flex-col gap-3">
                <pre className="whitespace-pre-wrap rounded-xl border border-sand-200 bg-sand-50 px-3.5 py-3 text-sm leading-relaxed text-ink font-sans">
                  {reportContent}
                </pre>

                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => console.log('Print report')}>
                    <Printer className="h-3.5 w-3.5" />
                    🖨️ Imprimer
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => console.log('Export report as PDF')}>
                    <FileText className="h-3.5 w-3.5" />
                    📄 Exporter PDF
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setIsValidated(false)}>
                    <Pencil className="h-3.5 w-3.5" />
                    ✏️ Modifier
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
