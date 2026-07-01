export type NotificationType = 'NewPost' | 'NewComment' | 'PatientUpdated';

export interface NotificationResponse {
  id: string;
  patientId: string;
  type: NotificationType;
  actorFirstName: string;
  actorLastName: string;
  patientFirstName: string;
  patientLastName: string;
  isRead: boolean;
  createdAt: string;
  /** Deep-link to the targeted content, e.g. /patients/{id}?postId={postId}&commentId={commentId}. */
  targetUrl?: string;
}
