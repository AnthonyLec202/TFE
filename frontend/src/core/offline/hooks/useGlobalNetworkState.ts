import { useContext } from 'react';
import { NetworkStateContext } from '../networkStateContext';

/**
 * Reads the global reachability state synchronously. `true` while the backend is believed reachable,
 * `false` when the browser is offline or the backend is unreachable. Must be called within a
 * NetworkStateProvider. Pages consume this instead of pinging on their own.
 */
export function useGlobalNetworkState(): boolean {
  const value = useContext(NetworkStateContext);
  if (value === null) {
    throw new Error('useGlobalNetworkState must be used within a NetworkStateProvider');
  }
  return value;
}
