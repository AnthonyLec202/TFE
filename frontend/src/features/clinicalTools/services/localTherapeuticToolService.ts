import { db, type LocalTherapeuticTool, type ToolType, type CbtTheme } from '../../../core/offline/LocalDatabase';
import type { TherapeuticToolResponse } from '../../../types/therapeuticTool';

/** Projects a server response into the local cache shape — the single source of this mapping. */
export function toLocalTool(tool: TherapeuticToolResponse): LocalTherapeuticTool {
  return {
    id: tool.id,
    title: tool.title,
    description: tool.description,
    type: tool.type,
    theme: tool.theme,
    downGradingStrategy: tool.downGradingStrategy,
    upGradingStrategy: tool.upGradingStrategy,
  };
}

/** Criteria for a local catalog query. Any field left undefined is not constrained. */
export interface ToolQueryCriteria {
  search?: string;
  type?: ToolType;
  theme?: CbtTheme;
}

/**
 * Executes a zero-latency catalog query entirely against the IndexedDB mirror — no network. The
 * text term is matched (case-insensitive substring) against Title or Description; Type and Theme are
 * exact-match enum filters. All predicates combine with AND.
 *
 * Strategy: when a Type or Theme filter is present we seed the query from the corresponding Dexie
 * index (sessions of the store are indexed on both) to avoid a full-table scan, then apply the
 * remaining predicates in memory. With no enum filter we read the whole (small, practitioner-sized)
 * catalog and filter in memory.
 */
export async function queryTherapeuticTools(
  criteria: ToolQueryCriteria,
): Promise<LocalTherapeuticTool[]> {
  const { search, type, theme } = criteria;

  let collection;
  if (type !== undefined) {
    collection = db.therapeuticTools.where('type').equals(type);
    if (theme !== undefined) collection = collection.and(tool => tool.theme === theme);
  } else if (theme !== undefined) {
    collection = db.therapeuticTools.where('theme').equals(theme);
  } else {
    collection = db.therapeuticTools.toCollection();
  }

  const term = search?.trim().toLowerCase();
  if (term) {
    collection = collection.and(
      tool =>
        tool.title.toLowerCase().includes(term) ||
        tool.description.toLowerCase().includes(term),
    );
  }

  return collection.sortBy('title');
}

export async function getToolById(id: string): Promise<LocalTherapeuticTool | undefined> {
  return db.therapeuticTools.get(id);
}

/**
 * Distinct, alphabetically sorted list of the Type values currently present in the local catalog.
 * Backs the creatable combobox's suggestions: the practitioner sees existing categories yet can type
 * an entirely new one. Reads straight off the indexed `type` key, so it never scans the full store.
 */
export async function getUniqueToolTypes(): Promise<string[]> {
  const keys = await db.therapeuticTools.orderBy('type').uniqueKeys();
  return (keys as string[]).filter(value => value.trim() !== '');
}

/** Distinct, sorted list of the Theme values present locally — feeds the Theme creatable combobox. */
export async function getUniqueToolThemes(): Promise<string[]> {
  const keys = await db.therapeuticTools.orderBy('theme').uniqueKeys();
  return (keys as string[]).filter(value => value.trim() !== '');
}

/**
 * Writes a single tool into the local mirror (e.g. immediately after an admin create), so the
 * reactive catalog reflects it without waiting for the next full hydration. Local-first.
 */
export async function upsertLocalTool(tool: LocalTherapeuticTool): Promise<void> {
  await db.therapeuticTools.put(tool);
}

/**
 * Removes a tool from the local mirror (e.g. immediately after an admin delete), so it disappears
 * from the reactive catalog at once.
 */
export async function removeLocalTool(id: string): Promise<void> {
  await db.therapeuticTools.delete(id);
}

/**
 * Reconciles the local catalog mirror against the authoritative server list: removes tools deleted
 * server-side, then upserts the current set in one transaction. The single source of the
 * cache-replacement logic, called by the sync/hydration service.
 */
export async function replaceLocalToolCatalog(tools: LocalTherapeuticTool[]): Promise<void> {
  const serverIds = new Set(tools.map(t => t.id));

  await db.transaction('rw', db.therapeuticTools, async () => {
    const localIds = (await db.therapeuticTools.toCollection().primaryKeys()) as string[];
    const staleIds = localIds.filter(id => !serverIds.has(id));
    if (staleIds.length > 0) await db.therapeuticTools.bulkDelete(staleIds);
    await db.therapeuticTools.bulkPut(tools);
  });
}
