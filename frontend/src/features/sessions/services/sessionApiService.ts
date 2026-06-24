import { apiClient } from '../../../services/apiClient';
import type { LocalSessionAttendance } from '../../../core/offline/LocalDatabase';

interface SyncSessionPayload {
  id: string;
  title: string;
  date: string;
  time: string;
  isClosed: boolean;
  patientIds: string[];
  toolIds: string[];
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

/** A decrypted session returned by the server for cross-device hydration. */
export interface SessionPayload {
  id: string;
  title: string;
  date: string;
  time: string;
  isClosed: boolean;
  patientIds: string[];
  toolIds: string[];
  attendances: LocalSessionAttendance[];
}

/** A decrypted session note returned by the server for cross-device hydration. */
export interface SessionNotePayload {
  id: string;
  sessionId: string;
  content: string;
  lastModifiedAt: string;
}

export interface UpdateSessionPayload {
  title: string;
  date: string;
  time: string;
  isClosed: boolean;
  patientIds: string[];
  toolIds: string[];
  attendances: LocalSessionAttendance[];
}

export function syncSessionsBatch(payload: SyncBatchPayload): Promise<void> {
  return apiClient.postVoid('/api/sessions/sync', payload);
}

/** Pulls the caller's sessions (server-decrypted) for local hydration. */
export function getSessions(): Promise<SessionPayload[]> {
  return apiClient.get<SessionPayload[]>('/api/sessions', { cache: 'no-store' });
}

/** Pulls the caller's session notes (server-decrypted plaintext) for local hydration. */
export function getSessionNotes(): Promise<SessionNotePayload[]> {
  return apiClient.get<SessionNotePayload[]>('/api/sessions/notes', { cache: 'no-store' });
}

export function updateSession(id: string, payload: UpdateSessionPayload): Promise<void> {
  return apiClient.put<void>(`/api/sessions/${id}`, payload);
}

export function deleteSession(id: string): Promise<void> {
  return apiClient.delete<void>(`/api/sessions/${id}`);
}
