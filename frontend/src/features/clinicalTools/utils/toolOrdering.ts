/**
 * Ordering rules for the catalog list.
 *
 * Pure helpers: no React, no I/O.
 */
import type { LocalTherapeuticTool } from '../../../core/offline/LocalDatabase';

/**
 * Groups the tools attached to the current session at the head of the list.
 *
 * A stable partition: the incoming order — the catalog's alphabetical sort — is preserved inside each
 * group, so attaching a tool moves it up and changes nothing else.
 *
 * WHY NOT "MOST RECENTLY ATTACHED FIRST"
 * That would be the closer reading of the request, and it works locally: attaching appends to the
 * session's tool list, so insertion order is there to read. It does not survive a round-trip to the
 * server, which projects the association from an unordered navigation collection — after the next
 * sync pull the "most recent" tool would be whichever one the database happened to return first.
 * Grouping without claiming an order inside the group is the part that stays true.
 */
export function sortAssociatedFirst(
  tools: LocalTherapeuticTool[],
  associatedToolIds: Set<string> | undefined,
): LocalTherapeuticTool[] {
  if (!associatedToolIds || associatedToolIds.size === 0) return tools;

  const associated: LocalTherapeuticTool[] = [];
  const rest: LocalTherapeuticTool[] = [];

  for (const tool of tools) {
    if (associatedToolIds.has(tool.id)) associated.push(tool);
    else rest.push(tool);
  }

  return [...associated, ...rest];
}
