import { useEffect, useState } from 'react';
import { ToolType, CbtTheme } from '../../core/offline/LocalDatabase';
import type { LocalTherapeuticTool } from '../../core/offline/LocalDatabase';
import type { CreateTherapeuticToolPayload } from '../../types/therapeuticTool';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useAuth } from '../auth';
import { useTherapeuticToolSearch } from './hooks/useTherapeuticToolSearch';
import { syncTherapeuticToolsFromServer } from './services/therapeuticToolSyncService';
import { createTool, deleteTool } from './services/therapeuticToolCommandService';
import { ToolFilters } from './components/ToolFilters';
import { ToolLibrary } from './components/ToolLibrary';
import { ToolCreationForm } from './components/ToolCreationForm';

/**
 * Optional association context, injected by a consumer that owns a session (e.g. the session
 * workspace). When provided, each card exposes the associate/dissociate toggle. The container itself
 * stays decoupled from the sessions feature — it never reads or mutates the session table — so the
 * dependency points one way (sessions → clinicalTools) with no cycle.
 */
export interface ToolAssociationContext {
  associatedToolIds: Set<string>;
  pendingToolIds: Set<string>;
  onToggle: (tool: LocalTherapeuticTool) => void;
}

export interface ClinicalToolsContainerProps {
  association?: ToolAssociationContext;
  /**
   * Suppresses the admin create/delete actions even for an Admin user. Set when the catalog is
   * embedded in a focused context (e.g. the in-session tools drawer) where the clinician should only
   * browse and associate, not curate the library.
   */
  hideAdminControls?: boolean;
  /**
   * Compact rendering for constrained contexts (e.g. the in-session drawer): a single stacked column,
   * cards collapsed to title + association toggle only. The filter panel stays fully functional. The
   * main "Mes Outils" page uses the default (false) split-screen master/detail layout instead.
   */
  isCompactView?: boolean;
}

interface ToolFormState {
  title: string;
  description: string;
  type: ToolType;
  theme: CbtTheme;
  downGradingStrategy: string;
  upGradingStrategy: string;
}

const EMPTY_TOOL_FORM: ToolFormState = {
  title: '',
  description: '',
  type: ToolType.CognitiveRestructuringSheet,
  theme: CbtTheme.CognitiveDistortions,
  downGradingStrategy: '',
  upGradingStrategy: '',
};

// Top-level container: owns the local search state (via the hook), the best-effort catalog pull on
// mount, and the admin-only create/delete commands. Association behaviour, when present, is supplied
// by the parent. Renders a split-screen master/detail layout on the main page, or a single compact
// column when embedded in the in-session drawer.
export function ClinicalToolsContainer({
  association, hideAdminControls = false, isCompactView = false,
}: ClinicalToolsContainerProps) {
  const { user } = useAuth();
  // Admin curation controls render only for an Admin AND when not explicitly suppressed by the host.
  const canManage = (user?.roles?.includes('Admin') ?? false) && !hideAdminControls;

  const { state, setSearch, setType, setTheme, reset, results, isLoading } = useTherapeuticToolSearch();

  // Hydrate the local mirror from the server once on mount (best-effort: offline falls back to cache).
  useEffect(() => {
    if (!navigator.onLine) return;
    syncTherapeuticToolsFromServer().catch(err => {
      console.warn('[ClinicalTools] Catalog hydration failed — using cached data.', err);
    });
  }, []);

  // ── Master/detail expansion (main page only) ───────────────────────────────
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);
  const toggleExpand = (tool: LocalTherapeuticTool) =>
    setExpandedToolId(prev => (prev === tool.id ? null : tool.id));

  // ── Create (admin, embedded form) ──────────────────────────────────────────
  const [form, setForm] = useState<ToolFormState>(EMPTY_TOOL_FORM);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>(undefined);

  async function handleCreate(): Promise<void> {
    setIsCreating(true);
    setCreateError(undefined);
    try {
      const payload: CreateTherapeuticToolPayload = {
        title: form.title.trim(),
        description: form.description.trim(),
        type: form.type,
        theme: form.theme,
        downGradingStrategy: form.downGradingStrategy.trim(),
        upGradingStrategy: form.upGradingStrategy.trim(),
      };
      // Server-authoritative write, then synchronous local cache update (inside createTool).
      await createTool(payload);
      setForm(EMPTY_TOOL_FORM); // reset the persistent form on success
    } catch (err) {
      setCreateError("La création a échoué. Vérifiez la connexion et réessayez.");
      console.error('[ClinicalTools] Tool creation failed.', err);
    } finally {
      setIsCreating(false);
    }
  }

  // ── Delete (admin) ─────────────────────────────────────────────────────────
  const [toolPendingDelete, setToolPendingDelete] = useState<LocalTherapeuticTool | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirmDelete(): Promise<void> {
    if (!toolPendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteTool(toolPendingDelete.id);
      setToolPendingDelete(null);
    } catch (err) {
      console.error('[ClinicalTools] Tool deletion failed.', err);
    } finally {
      setIsDeleting(false);
    }
  }

  const filters = (
    <ToolFilters
      search={state.search}
      type={state.type}
      theme={state.theme}
      onSearchChange={setSearch}
      onTypeChange={setType}
      onThemeChange={setTheme}
      onReset={reset}
    />
  );

  // ── Compact (in-session drawer): single stacked column, no creation panel ──
  if (isCompactView) {
    return (
      <div className="flex flex-col gap-5">
        {filters}
        <ToolLibrary
          tools={results ?? []}
          isLoading={isLoading}
          associatedToolIds={association?.associatedToolIds}
          pendingToolIds={association?.pendingToolIds}
          onToggleAssociation={association?.onToggle}
          isCompactView
        />
      </div>
    );
  }

  // ── Main page: split-screen master/detail (left creation sidebar, right list) ──
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {canManage && (
          <div className="lg:col-span-1">
            <ToolCreationForm
              title={form.title}
              description={form.description}
              type={form.type}
              theme={form.theme}
              downGradingStrategy={form.downGradingStrategy}
              upGradingStrategy={form.upGradingStrategy}
              submitting={isCreating}
              error={createError}
              onTitleChange={value => setForm(prev => ({ ...prev, title: value }))}
              onDescriptionChange={value => setForm(prev => ({ ...prev, description: value }))}
              onTypeChange={value => setForm(prev => ({ ...prev, type: value }))}
              onThemeChange={value => setForm(prev => ({ ...prev, theme: value }))}
              onDownGradingStrategyChange={value => setForm(prev => ({ ...prev, downGradingStrategy: value }))}
              onUpGradingStrategyChange={value => setForm(prev => ({ ...prev, upGradingStrategy: value }))}
              onSubmit={handleCreate}
            />
          </div>
        )}

        {/* The list takes the full width when there is no creation sidebar (non-admin). */}
        <div className={`${canManage ? 'lg:col-span-2' : 'lg:col-span-3'} flex flex-col gap-4`}>
          {filters}
          <ToolLibrary
            tools={results ?? []}
            isLoading={isLoading}
            canManage={canManage}
            onDeleteTool={setToolPendingDelete}
            isExpandable
            expandedToolId={expandedToolId}
            onToggleExpand={toggleExpand}
          />
        </div>
      </div>

      <ConfirmDialog
        open={toolPendingDelete !== null}
        title="Supprimer l'outil"
        message={
          toolPendingDelete
            ? `« ${toolPendingDelete.title} » sera définitivement supprimé de la bibliothèque. Cette action est irréversible.`
            : ''
        }
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setToolPendingDelete(null)}
      />
    </>
  );
}
