import { createContext } from 'react';

/**
 * Backend-reachability context, held in its own module so `NetworkStateProvider.tsx` exports the
 * component alone. A file mixing a component with other exports defeats Fast Refresh, which can then
 * only reload the whole module tree instead of preserving state.
 *
 * `null` distinguishes "no provider mounted" from a real boolean value.
 */
export const NetworkStateContext = createContext<boolean | null>(null);
