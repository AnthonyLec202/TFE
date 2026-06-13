import { apiClient } from './apiClient';
import type { CareTeamMemberResponse, CreatePatientPayload, InvitationResponse, PatientResponse, UpdatePatientPayload } from '../types/patient';

// 'no-store' bypasses the browser HTTP cache so a refetch (e.g. right after the offline queue
// drains) always hits the database and reflects newly created patients, never a stale list.
export const getPatients = (): Promise<PatientResponse[]> =>
  apiClient.get<PatientResponse[]>('/api/patients', { cache: 'no-store' });

export const createPatient = (data: CreatePatientPayload): Promise<PatientResponse> =>
  apiClient.post<PatientResponse>('/api/patients', data);

export const getPatient = (id: string): Promise<PatientResponse> =>
  apiClient.get<PatientResponse>(`/api/patients/${id}`);

export const generateInvitation = (patientId: string, roleTarget: string): Promise<InvitationResponse> =>
  apiClient.post<InvitationResponse>(`/api/patients/${patientId}/invitations`, { roleTarget });

export const updatePatient = (id: string, data: UpdatePatientPayload): Promise<PatientResponse> =>
  apiClient.put<PatientResponse>(`/api/patients/${id}`, data);

export const deletePatient = (id: string): Promise<void> =>
  apiClient.delete<void>(`/api/patients/${id}`);

export const getCareTeam = (patientId: string): Promise<CareTeamMemberResponse[]> =>
  apiClient.get<CareTeamMemberResponse[]>(`/api/patients/${patientId}/team`);

export const removeCareTeamMember = (patientId: string, userId: string): Promise<void> =>
  apiClient.delete<void>(`/api/patients/${patientId}/team/${userId}`);
