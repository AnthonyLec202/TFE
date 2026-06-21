import { ArrowDownNarrowWide, ArrowUpNarrowWide, Check, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react';
import type { LocalTherapeuticTool } from '../../../core/offline/LocalDatabase';
import { Card } from '../../../components/ui/Card';
import { TOOL_TYPE_LABELS, CBT_THEME_LABELS } from '../utils/toolLabels';

export interface ToolCardProps {
  tool: LocalTherapeuticTool;
  /**
   * Association context. Provided only when the card is rendered against an active session: it then
   * exposes the "add to / remove from current session" toggle. Omitted on the standalone catalog
   * page, where the card is purely informational.
   */
  association?: {
    isAssociated: boolean;
    isPending: boolean;
    onToggle: (tool: LocalTherapeuticTool) => void;
  };
  /** When true (admin), the card exposes a Delete action. */
  canManage?: boolean;
  onDelete?: (tool: LocalTherapeuticTool) => void;
  /**
   * Compact rendering: collapse to the title + association toggle only, suppressing the badges,
   * description and strategy panels. Used inside the constrained in-session drawer.
   */
  isCompactView?: boolean;
  /**
   * Master/detail mode (main page): the header becomes a clickable toggle and the details (description
   * + strategy panels) render only when this card is the expanded one.
   */
  isExpandable?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: (tool: LocalTherapeuticTool) => void;
}

// Pure presentational clinical card. Surfaces the adaptive scaffolding (down/up-grading strategies)
// in dedicated, colour-coded sub-panels so the clinician can scan them instantly mid-session. Three
// display modes: compact (title + association toggle), expandable master/detail, or always-full.
export function ToolCard({
  tool, association, canManage = false, onDelete,
  isCompactView = false, isExpandable = false, isExpanded = false, onToggleExpand,
}: ToolCardProps) {
  // Details are shown when not compact and either the card is not collapsible or it is expanded.
  const showDetails = !isCompactView && (!isExpandable || isExpanded);
  const showBadges = !isCompactView;
  const headerInteractive = isExpandable && !isCompactView && !!onToggleExpand;

  const titleNode = headerInteractive ? (
    <button
      type="button"
      onClick={() => onToggleExpand!(tool)}
      aria-expanded={isExpanded}
      className="flex min-w-0 flex-1 items-center gap-2 text-left"
    >
      <ChevronRight
        className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
      />
      <h3 className="truncate text-base font-semibold text-slate-900 leading-snug">{tool.title}</h3>
    </button>
  ) : (
    <h3 className="text-base font-semibold text-slate-900 leading-snug">{tool.title}</h3>
  );

  return (
    <Card className={`flex flex-col ${isCompactView ? 'gap-0 p-3' : 'gap-4 p-5'}`}>
      <header className={`flex flex-col ${isCompactView ? 'gap-0' : 'gap-2'}`}>
        <div className="flex items-start justify-between gap-3">
          {titleNode}
          <div className="flex items-center gap-1.5 shrink-0">
            {association && (
              <AssociationToggle
                isAssociated={association.isAssociated}
                isPending={association.isPending}
                onClick={() => association.onToggle(tool)}
              />
            )}
            {canManage && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(tool)}
                aria-label="Supprimer l'outil"
                title="Supprimer l'outil"
                className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Badges are suppressed in compact mode; they stay visible as the collapsed summary. */}
        {showBadges && (
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              {TOOL_TYPE_LABELS[tool.type]}
            </span>
            <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
              {CBT_THEME_LABELS[tool.theme]}
            </span>
          </div>
        )}
      </header>

      {showDetails && (
        <>
          <p className="text-sm text-slate-600 leading-relaxed">{tool.description}</p>

          {/* Clinical scaffolding — the differentiating value, highlighted in dedicated sub-panels. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StrategyPanel
              tone="downgrade"
              icon={<ArrowDownNarrowWide className="h-4 w-4" />}
              label="Stratégie de simplification"
              text={tool.downGradingStrategy}
            />
            <StrategyPanel
              tone="upgrade"
              icon={<ArrowUpNarrowWide className="h-4 w-4" />}
              label="Stratégie de progression"
              text={tool.upGradingStrategy}
            />
          </div>
        </>
      )}
    </Card>
  );
}

function AssociationToggle({
  isAssociated, isPending, onClick,
}: { isAssociated: boolean; isPending: boolean; onClick: () => void }) {
  const base =
    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none shrink-0';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      aria-pressed={isAssociated}
      className={
        isAssociated
          ? `${base} bg-emerald-50 text-emerald-700 hover:bg-emerald-100`
          : `${base} bg-blue-600 text-white hover:bg-blue-700`
      }
    >
      {isPending
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : isAssociated
          ? <Check className="h-3.5 w-3.5" />
          : <Plus className="h-3.5 w-3.5" />}
      {isAssociated ? 'Ajouté à la séance' : 'Ajouter à la séance'}
    </button>
  );
}

const PANEL_TONES = {
  downgrade: 'border-amber-200 bg-amber-50 text-amber-900',
  upgrade: 'border-emerald-200 bg-emerald-50 text-emerald-900',
} as const;

function StrategyPanel({
  tone, icon, label, text,
}: { tone: keyof typeof PANEL_TONES; icon: React.ReactNode; label: string; text: string }) {
  return (
    <div className={`rounded-xl border p-3 ${PANEL_TONES[tone]}`}>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <p className="text-sm leading-relaxed">{text || '—'}</p>
    </div>
  );
}
