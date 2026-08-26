import { describe, it, expect } from 'vitest';
import { sortAssociatedFirst } from './toolOrdering';
import type { LocalTherapeuticTool } from '../../../core/offline/LocalDatabase';

/** A catalog entry reduced to what the ordering rule reads. */
function tool(id: string, title = id): LocalTherapeuticTool {
  return {
    id,
    title,
    type: 'Jeu',
    theme: 'Attention',
    description: '',
    downGradingStrategy: '',
    upGradingStrategy: '',
  } as LocalTherapeuticTool;
}

/** Ids in render order — all these assertions are about order. */
function order(tools: LocalTherapeuticTool[]): string[] {
  return tools.map(t => t.id);
}

describe('sortAssociatedFirst', () => {
  const catalog = [tool('a'), tool('b'), tool('c'), tool('d')];

  it('moves an attached tool to the head of the list', () => {
    expect(order(sortAssociatedFirst(catalog, new Set(['c'])))).toEqual(['c', 'a', 'b', 'd']);
  });

  it('keeps the catalog order inside each group', () => {
    // 'b' before 'd' among the attached, 'a' before 'c' among the rest — the incoming alphabetical
    // sort survives the partition, so attaching one tool never reshuffles the others.
    expect(order(sortAssociatedFirst(catalog, new Set(['d', 'b'])))).toEqual(['b', 'd', 'a', 'c']);
  });

  it('leaves the list untouched when nothing is attached', () => {
    expect(order(sortAssociatedFirst(catalog, new Set()))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('leaves the list untouched outside a session context', () => {
    expect(order(sortAssociatedFirst(catalog, undefined))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns the same order when every tool is attached', () => {
    const all = new Set(['a', 'b', 'c', 'd']);

    expect(order(sortAssociatedFirst(catalog, all))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('ignores attached ids the catalog does not hold', () => {
    // The session may reference a tool the local mirror has not pulled, or one since deleted.
    expect(order(sortAssociatedFirst(catalog, new Set(['zz', 'b'])))).toEqual(['b', 'a', 'c', 'd']);
  });

  it('handles an empty catalog', () => {
    expect(sortAssociatedFirst([], new Set(['a']))).toEqual([]);
  });

  it('does not mutate the list it was given', () => {
    const input = [...catalog];
    sortAssociatedFirst(input, new Set(['d']));

    expect(order(input)).toEqual(['a', 'b', 'c', 'd']);
  });
});
