export interface NotificationResponse {
  id: string;
  patientId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  /** Deep-link to the targeted content, e.g. /patients/{id}?postId={postId}&commentId={commentId}. */
  targetUrl?: string;
}
