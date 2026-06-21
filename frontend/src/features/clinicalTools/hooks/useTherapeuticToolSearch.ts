import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { LocalTherapeuticTool, ToolType, CbtTheme } from '../../../core/offline/LocalDatabase';
import { queryTherapeuticTools } from '../services/localTherapeuticToolService';

export interface ToolSearchState {
  search: string;
  type: ToolType | null;
  theme: CbtTheme | null;
}

export interface UseTherapeuticToolSearch {
  state: ToolSearchState;
  setSearch: (value: string) => void;
  setType: (value: ToolType | null) => void;
  setTheme: (value: CbtTheme | null) => void;
  reset: () => void;
  /** Reactive result of the local IndexedDB query; `undefined` while the first query is in flight. */
  results: LocalTherapeuticTool[] | undefined;
  isLoading: boolean;
}

const INITIAL_STATE: ToolSearchState = { search: '', type: null, theme: null };

/**
 * Owns the catalog filter state and re-runs the local Dexie query reactively whenever a criterion
 * changes — or whenever the underlying store mutates (useLiveQuery), so a freshly synced catalog
 * appears without a manual refetch. No network access: every keystroke filters the local mirror.
 */
export function useTherapeuticToolSearch(): UseTherapeuticToolSearch {
  const [state, setState] = useState<ToolSearchState>(INITIAL_STATE);

  const results = useLiveQuery(
    () =>
      queryTherapeuticTools({
        search: state.search,
        type: state.type ?? undefined,
        theme: state.theme ?? undefined,
      }),
    [state.search, state.type, state.theme],
  );

  return useMemo(
    () => ({
      state,
      setSearch: (search: string) => setState(prev => ({ ...prev, search })),
      setType: (type: ToolType | null) => setState(prev => ({ ...prev, type })),
      setTheme: (theme: CbtTheme | null) => setState(prev => ({ ...prev, theme })),
      reset: () => setState(INITIAL_STATE),
      results,
      isLoading: results === undefined,
    }),
    [state, results],
  );
}
