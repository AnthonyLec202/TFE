import { useCallback, useEffect, useState } from 'react';
import { HubConnectionBuilder, type HubConnection } from '@microsoft/signalr';
import { useAuth } from '../../auth';
import { API_BASE } from '../../../services/apiClient';
import { getUnreadNotifications, markNotificationAsRead } from '../../../services/notificationService';
import type { NotificationResponse } from '../../../types/notification';

export interface UseGlobalNotificationsResult {
  notifications: NotificationResponse[];
  loading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
}

// Purely online global notification feed: hydrates from the unread-notifications endpoint, then
// keeps itself current via the shared collaborative-wall hub's personal user group. Holds no
// offline/Dexie state — if the connection cannot be established, the bell simply shows whatever
// was loaded from the initial REST fetch.
export function useGlobalNotifications(): UseGlobalNotificationsResult {
  const { isAuthenticated, isInitialized } = useAuth();
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Same reasoning as the wall: the loading flag is raised during the render that opens the session,
  // not from the effect that performs the fetch.
  const canFetch = isInitialized && isAuthenticated;
  const [fetchingFor, setFetchingFor] = useState(canFetch);
  if (fetchingFor !== canFetch) {
    setFetchingFor(canFetch);
    if (canFetch) setLoading(true);
  }

  useEffect(() => {
    if (!canFetch) return;

    let ignore = false;
    getUnreadNotifications()
      .then(data => { if (!ignore) setNotifications(data); })
      .catch(() => { /* the bell simply stays empty if the initial fetch fails */ })
      .finally(() => { if (!ignore) setLoading(false); });

    return () => { ignore = true; };
  }, [canFetch]);

  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;

    // Cookie auth: the first-party HttpOnly session cookie rides the negotiate request and the
    // transport automatically (withCredentials), so no access_token query param is needed. The
    // transport itself is negotiated — WebSocket in development, Server-Sent Events in production,
    // where the same-origin proxy that makes the cookie first-party cannot tunnel an upgrade.
    const connection: HubConnection = new HubConnectionBuilder()
      .withUrl(`${API_BASE}/hubs/collaborative-wall`, {
        withCredentials: true,
      })
      .withAutomaticReconnect()
      .build();

    let cancelled = false;

    connection.on('ReceiveNotification', (notification: NotificationResponse) => {
      setNotifications(prev => prev.some(n => n.id === notification.id) ? prev : [notification, ...prev]);
    });

    // Retain the start promise so cleanup can wait for negotiation to settle before stopping.
    // Stopping a connection mid-negotiation makes SignalR log "The connection was stopped during
    // negotiation" — notably on React StrictMode's mount → unmount → mount in development.
    const startPromise = connection
      .start()
      .catch(err => {
        // Only warn for genuine, user-visible failures, not for a teardown-triggered abort.
        if (!cancelled) {
          console.warn('[GlobalNotifications] Connection failed — real-time updates unavailable.', err);
        }
      });

    return () => {
      cancelled = true;
      connection.off('ReceiveNotification');
      // Defer stop() until start() has settled so we never abort an in-flight negotiation.
      void startPromise.then(() => connection.stop()).catch(() => {});
    };
  }, [isInitialized, isAuthenticated]);

  const markAsRead = useCallback(async (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    try {
      await markNotificationAsRead(notificationId);
    } catch {
      // Best-effort: the notification stays cleared from the bell even if the PATCH fails.
    }
  }, []);

  return { notifications, loading, markAsRead };
}
