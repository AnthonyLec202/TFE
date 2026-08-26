import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { LocalTherapeuticTool } from '../../core/offline/LocalDatabase';
import type { CreateTherapeuticToolPayload } from '../../types/therapeuticTool';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useGlobalNetworkState } from '../../core/offline/NetworkStateProvider';
import { useAuth } from '../auth';
import { useTherapeuticToolSearch } from './hooks/useTherapeuticToolSearch';
import { syncTherapeuticToolsFromServer } from './services/therapeuticToolSyncService';
import { createTool, deleteTool } from './services/therapeuticToolCommandService';
import { getUniqueToolTypes, getUniqueToolThemes } from './services/localTherapeuticToolService';
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
   * Compact rendering for constrained contexts (e.g. the in-session drawer): a single stacked column
   * with cards collapsed to title + association toggle. The main "Mes Outils" page uses the default
   * (false) split-screen master/detail layout instead.
   */
  isCompactView?: boolean;
  /**
   * Navigation callback: invoked with a tool id when an item is opened, so the host routes to the
   * tool's detail page. Drives the whole row on the main page and the title alone in the compact
   * drawer. A session-owning host passes one that carries the session id in router state, which is
   * what lets the detail page offer a return path to the séance.
   */
  onSelectTool?: (toolId: string) => void;
}

interface ToolFormState {
  title: string;
  type: string;
  theme: string;
}

const EMPTY_TOOL_FORM: ToolFormState = { title: '', type: '', theme: '' };

// Top-level container: owns the local search state (via the hook), the best-effort catalog pull on
// mount, and the admin-only create/delete commands. Association behaviour, when present, is supplied
// by the parent. Renders a split-screen master/detail layout on the main page (the list navigates to
// per-tool detail pages), or a single compact column when embedded in the in-session drawer.
export function ClinicalToolsContainer({
  association, hideAdminControls = false, isCompactView = false, onSelectTool,
}: ClinicalToolsContainerProps) {
  const { user } = useAuth();
  // Admin curation controls render only for an Admin AND when not explicitly suppressed by the host.
  const canManage = (user?.roles?.includes('Admin') ?? false) && !hideAdminControls;

  // Robust backend reachability (not just navigator.onLine), read from the hoisted global state:
  // creation requires a live server, so the submit button is disabled while it is unreachable.
  const isOnline = useGlobalNetworkState();

  const { state, setSearch, setType, setTheme, reset, results, isLoading } = useTherapeuticToolSearch();

  // Distinct Type/Theme values present in the local mirror, fed to the creatable comboboxes and the
  // filter dropdowns. Reactive: a newly created category appears in the suggestions immediately.
  const typeOptions = useLiveQuery(() => getUniqueToolTypes(), []) ?? [];
  const themeOptions = useLiveQuery(() => getUniqueToolThemes(), []) ?? [];

  // Hydrate the local mirror from the server once on mount (best-effort: offline falls back to cache).
  useEffect(() => {
    if (!navigator.onLine) return;
    syncTherapeuticToolsFromServer().catch(err => {
      console.warn('[ClinicalTools] Catalog hydration failed — using cached data.', err);
    });
  }, []);

  // ── Create (admin, embedded form) ──────────────────────────────────────────
  const [form, setForm] = useState<ToolFormState>(EMPTY_TOOL_FORM);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>(undefined);

  async function handleCreate(): Promise<void> {
    setIsCreating(true);
    setCreateError(undefined);
    try {
      // Only identity + categories are captured here; the rich clinical content is authored on the
      // detail page, so it starts empty.
      const payload: CreateTherapeuticToolPayload = {
        title: form.title.trim(),
        type: form.type.trim(),
        theme: form.theme.trim(),
        description: '',
        downGradingStrategy: '',
        upGradingStrategy: '',
      };
      const created = await createTool(payload);
      setForm(EMPTY_TOOL_FORM);
      // Jump straight into the new tool's detail page to author its content.
      onSelectTool?.(created.id);
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
      typeOptions={typeOptions}
      themeOptions={themeOptions}
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
          onSelectTool={onSelectTool ? tool => onSelectTool(tool.id) : undefined}
          isCompactView
        />
      </div>
    );
  }

  // ── Main page: split-screen master/detail (left creation sidebar, right list) ──
  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr] items-start">
        {canManage && (
          <ToolCreationForm
            title={form.title}
            type={form.type}
            theme={form.theme}
            typeOptions={typeOptions}
            themeOptions={themeOptions}
            submitting={isCreating}
            isOnline={isOnline}
            error={createError}
            onTitleChange={value => setForm(prev => ({ ...prev, title: value }))}
            onTypeChange={value => setForm(prev => ({ ...prev, type: value }))}
            onThemeChange={value => setForm(prev => ({ ...prev, theme: value }))}
            onSubmit={handleCreate}
          />
        )}

        {/* The list takes the full width when there is no creation sidebar (non-admin). */}
        <div className={`${canManage ? '' : 'lg:col-span-2'} flex flex-col gap-4`}>
          {filters}
          <ToolLibrary
            tools={results ?? []}
            isLoading={isLoading}
            canManage={canManage}
            onDeleteTool={setToolPendingDelete}
            onSelectTool={onSelectTool ? tool => onSelectTool(tool.id) : undefined}
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
