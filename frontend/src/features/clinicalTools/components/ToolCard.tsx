import { Check, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react';
import type { LocalTherapeuticTool } from '../../../core/offline/LocalDatabase';
import { Card } from '../../../components/ui/Card';

export interface ToolCardProps {
  tool: LocalTherapeuticTool;
  /**
   * Association context. Provided only when the card is rendered against an active session (the
   * in-session drawer): it then exposes the "add to / remove from current session" toggle.
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
   * Compact rendering: collapse to the title + association toggle only, suppressing the category
   * badges. Used inside the constrained in-session drawer.
   */
  isCompactView?: boolean;
  /**
   * Navigates to the tool's detail page, where the clinical content (description, grading strategies)
   * lives. Drives the whole card in master-list mode, and the title alone in compact mode, where the
   * rest of the row belongs to the association toggle.
   */
  onSelect?: (tool: LocalTherapeuticTool) => void;
}

// Pure presentational catalog item. Two layouts: a clickable master-list row that routes to the
// detail page (main "Mes Outils" page), or a compact row with an association toggle (in-session
// drawer). Type/Theme are free-form category strings rendered as badges.
export function ToolCard({
  tool, association, canManage = false, onDelete, isCompactView = false, onSelect,
}: ToolCardProps) {
  const badges = !isCompactView && (
    <div className="flex flex-wrap gap-1.5">
      <span className="inline-flex items-center rounded-full bg-petrol-50 px-2.5 py-0.5 text-xs font-medium text-petrol-600">
        {tool.type}
      </span>
      <span className="inline-flex items-center rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-medium text-taupe-600">
        {tool.theme}
      </span>
    </div>
  );

  // ── Master-list mode: a clickable item navigating to the detail page ──
  // Compact rows opt out: there the row carries the association toggle, so making the whole card a
  // button would nest an interactive element inside another one.
  if (onSelect && !isCompactView) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(tool)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(tool);
          }
        }}
        className="block w-full cursor-pointer rounded-xl border border-sand-200 bg-white px-[18px] py-4 text-left transition-[border-color,box-shadow] hover:border-petrol-100 hover:shadow-[0_2px_10px_rgba(31,111,107,0.08)]"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <h3 className="truncate text-[15px] font-semibold text-ink">{tool.title}</h3>
            {badges}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {canManage && onDelete && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onDelete(tool);
                }}
                aria-label="Supprimer l'outil"
                title="Supprimer l'outil"
                className="inline-flex items-center justify-center rounded-lg p-1.5 text-taupe-400 transition-colors hover:bg-[#F6E9E6] hover:text-[#B5453C]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <ChevronRight className="h-5 w-5 text-[#C2BBB0]" />
          </div>
        </div>
      </div>
    );
  }

  // ── Compact mode: in-session drawer row with the association toggle ──
  return (
    <Card className="flex flex-col gap-0 p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
          {onSelect ? (
            // The title opens the tool's own page. A clinician who pulls the drawer open mid-session
            // is often there to read a tool's content, not only to attach it to the note.
            <button
              type="button"
              onClick={() => onSelect(tool)}
              title={`Ouvrir « ${tool.title} »`}
              className="block w-full truncate text-left transition-colors hover:text-petrol-600 hover:underline"
            >
              {tool.title}
            </button>
          ) : (
            tool.title
          )}
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
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
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-taupe-400 transition-colors hover:bg-[#F6E9E6] hover:text-[#B5453C]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
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
          ? `${base} bg-[#E6F0EA] text-[#2F7D5B] hover:bg-[#d8e8df]`
          : `${base} bg-petrol-600 text-white hover:bg-petrol-700`
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
