import { apiClient } from './apiClient';
import type { CreatePatientPayload, InvitationResponse, PatientResponse, UpdatePatientPayload } from '../types/patient';

export const getPatients = (): Promise<PatientResponse[]> =>
  apiClient.get<PatientResponse[]>('/api/patients');

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
