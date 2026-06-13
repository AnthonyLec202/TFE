import { apiClient } from './apiClient';
import type { NotificationResponse } from '../types/notification';

export const getUnreadNotifications = (): Promise<NotificationResponse[]> =>
  apiClient.get<NotificationResponse[]>('/api/notifications/unread');

export const markNotificationAsRead = (notificationId: string): Promise<void> =>
  apiClient.patch<void>(`/api/notifications/${notificationId}/read`, {});
