import { useEffect, useRef } from 'react';
import { HubConnectionBuilder, type HubConnection } from '@microsoft/signalr';
import { useAuth } from '../../auth';
import { API_BASE } from '../../../services/apiClient';
import type { PostResponse } from '../../../types/wall';

// Purely online real-time transport for the collaborative wall: pushes newly created posts to
// other clients viewing the same patient's wall. Holds no offline/Dexie state — if the connection
// cannot be established or drops, the feature simply falls back to its normal REST-loaded state
// (no retry queue, no local persistence).
export function useCollaborativeWallSocket(patientId: string, onPostReceived: (post: PostResponse) => void): void {
  const { token } = useAuth();

  // Keeps the latest callback available to the SignalR handler without re-creating the
  // connection whenever the caller passes a new function instance.
  const onPostReceivedRef = useRef(onPostReceived);
  onPostReceivedRef.current = onPostReceived;

  useEffect(() => {
    if (!token) return;

    const connection: HubConnection = new HubConnectionBuilder()
      .withUrl(`${API_BASE}/hubs/collaborative-wall`, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect()
      .build();

    connection.on('ReceiveNewPost', (post: PostResponse) => {
      onPostReceivedRef.current(post);
    });

    connection
      .start()
      .then(() => connection.invoke('JoinWallGroup', patientId))
      .catch(err => console.warn('[CollaborativeWallSocket] Connection failed — real-time updates unavailable.', err));

    return () => {
      connection.off('ReceiveNewPost');
      void connection.stop();
    };
  }, [patientId, token]);
}
