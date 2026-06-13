import { apiClient } from '../../../services/apiClient';
import type { LocalSessionAttendance } from '../../../core/offline/LocalDatabase';

interface SyncSessionPayload {
  id: string;
  title: string;
  date: string;
  time: string;
  isClosed: boolean;
  patientIds: string[];
  attendances: LocalSessionAttendance[];
}

interface SyncNotePayload {
  id: string;
  sessionId: string;
  content: string;
  lastModifiedAt: string;
}

interface SyncBatchPayload {
  sessions: SyncSessionPayload[];
  notes: SyncNotePayload[];
}

export interface UpdateSessionPayload {
  title: string;
  date: string;
  time: string;
  isClosed: boolean;
  patientIds: string[];
  attendances: LocalSessionAttendance[];
}

export function syncSessionsBatch(payload: SyncBatchPayload): Promise<void> {
  return apiClient.postVoid('/api/sessions/sync', payload);
}

export function updateSession(id: string, payload: UpdateSessionPayload): Promise<void> {
  return apiClient.put<void>(`/api/sessions/${id}`, payload);
}

export function deleteSession(id: string): Promise<void> {
  return apiClient.delete<void>(`/api/sessions/${id}`);
}
