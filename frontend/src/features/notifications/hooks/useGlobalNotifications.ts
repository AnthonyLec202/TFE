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
  const { token, isInitialized } = useAuth();
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isInitialized || !token) return;

    let ignore = false;
    setLoading(true);
    getUnreadNotifications()
      .then(data => { if (!ignore) setNotifications(data); })
      .catch(() => { /* the bell simply stays empty if the initial fetch fails */ })
      .finally(() => { if (!ignore) setLoading(false); });

    return () => { ignore = true; };
  }, [isInitialized, token]);

  useEffect(() => {
    if (!token) return;

    const connection: HubConnection = new HubConnectionBuilder()
      .withUrl(`${API_BASE}/hubs/collaborative-wall`, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect()
      .build();

    let cancelled = false;

    connection.on('ReceiveNotification', (notification: NotificationResponse) => {
      setNotifications(prev => prev.some(n => n.id === notification.id) ? prev : [notification, ...prev]);
    });

    connection
      .start()
      .catch(err => {
        // AbortError is expected in React StrictMode (double-invoke cleanup stops the connection
        // mid-negotiation). Only warn for genuine, user-visible failures.
        if (!cancelled) {
          console.warn('[GlobalNotifications] Connection failed — real-time updates unavailable.', err);
        }
      });

    return () => {
      cancelled = true;
      connection.off('ReceiveNotification');
      void connection.stop();
    };
  }, [token]);

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
