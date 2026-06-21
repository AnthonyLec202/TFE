import { Loader2, SearchX } from 'lucide-react';
import type { LocalTherapeuticTool } from '../../../core/offline/LocalDatabase';
import { ToolCard } from './ToolCard';

export interface ToolLibraryProps {
  tools: LocalTherapeuticTool[];
  isLoading: boolean;
  /** Ids currently associated to the active session, when rendered in a session context. */
  associatedToolIds?: Set<string>;
  /** Tool ids whose association toggle is mid-flight (optimistic write pending). */
  pendingToolIds?: Set<string>;
  onToggleAssociation?: (tool: LocalTherapeuticTool) => void;
  /** When true (admin), each card exposes a Delete action wired to onDeleteTool. */
  canManage?: boolean;
  onDeleteTool?: (tool: LocalTherapeuticTool) => void;
  /** Compact cards (title + association toggle only) and a single-column layout. */
  isCompactView?: boolean;
  /** Master/detail mode: cards collapse to a clickable header and expand the active one on click. */
  isExpandable?: boolean;
  expandedToolId?: string | null;
  onToggleExpand?: (tool: LocalTherapeuticTool) => void;
}

// Pure presentational grid. Renders loading / empty / populated states and delegates each item to
// ToolCard, threading the optional per-session association context through.
export function ToolLibrary({
  tools, isLoading, associatedToolIds, pendingToolIds, onToggleAssociation, canManage, onDeleteTool,
  isCompactView = false, isExpandable = false, expandedToolId = null, onToggleExpand,
}: ToolLibraryProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Chargement de la matériauthèque ...</span>
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
        <SearchX className="h-8 w-8" />
        <p className="text-sm">Aucun outil ne correspond aux critères.</p>
      </div>
    );
  }

  const associationContext = onToggleAssociation
    ? (tool: LocalTherapeuticTool) => ({
        isAssociated: associatedToolIds?.has(tool.id) ?? false,
        isPending: pendingToolIds?.has(tool.id) ?? false,
        onToggle: onToggleAssociation,
      })
    : undefined;

  // Single column when compact (drawer) or expandable (master list); two-up otherwise.
  const gridClass = isCompactView || isExpandable
    ? 'grid grid-cols-1 gap-3'
    : 'grid grid-cols-1 gap-4 xl:grid-cols-2';

  return (
    <div className={gridClass}>
      {tools.map(tool => (
        <ToolCard
          key={tool.id}
          tool={tool}
          association={associationContext?.(tool)}
          canManage={canManage}
          onDelete={onDeleteTool}
          isCompactView={isCompactView}
          isExpandable={isExpandable}
          isExpanded={expandedToolId === tool.id}
          onToggleExpand={onToggleExpand}
        />
      ))}
    </div>
  );
}
