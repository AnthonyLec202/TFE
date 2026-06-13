export interface NotificationResponse {
  id: string;
  patientId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}
