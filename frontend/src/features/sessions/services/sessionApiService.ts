import { apiClient } from '../../../services/apiClient';

interface SyncSessionPayload {
  id: string;
  title: string;
  date: string;
  time: string;
  patientIds: string[];
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

export function syncSessionsBatch(payload: SyncBatchPayload): Promise<void> {
  return apiClient.postVoid('/api/sessions/sync', payload);
}
