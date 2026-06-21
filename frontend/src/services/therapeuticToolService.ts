import { apiClient } from './apiClient';
import type {
  CreateTherapeuticToolPayload,
  TherapeuticToolResponse,
  UpdateTherapeuticToolPayload,
} from '../types/therapeuticTool';

// 'no-store' bypasses the browser HTTP cache so a refetch always reflects the authoritative catalog,
// never a stale list.
export const getTherapeuticTools = (): Promise<TherapeuticToolResponse[]> =>
  apiClient.get<TherapeuticToolResponse[]>('/api/therapeutic-tools', { cache: 'no-store' });

export const createTherapeuticTool = (
  data: CreateTherapeuticToolPayload,
): Promise<TherapeuticToolResponse> =>
  apiClient.post<TherapeuticToolResponse>('/api/therapeutic-tools', data);

export const updateTherapeuticTool = (
  id: string,
  data: UpdateTherapeuticToolPayload,
): Promise<void> =>
  apiClient.put<void>(`/api/therapeutic-tools/${id}`, data);

export const deleteTherapeuticTool = (id: string): Promise<void> =>
  apiClient.delete<void>(`/api/therapeutic-tools/${id}`);
