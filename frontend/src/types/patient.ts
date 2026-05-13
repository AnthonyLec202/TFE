export type PatientUserRole = 'Admin' | 'Parent' | 'Collaborator';

export interface PatientResponse {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;    // ISO date "YYYY-MM-DD"
  userRole: PatientUserRole;
}

export interface UpdatePatientPayload {
  firstName: string;
  lastName: string;
  birthDate: string;    // ISO date "YYYY-MM-DD"
}

export interface CreatePatientPayload {
  firstName: string;
  lastName: string;
  birthDate: string;    // ISO date "YYYY-MM-DD"
}

export interface InvitationResponse {
  plainSecretCode: string;
  expiresAt: string;    // ISO datetime
}
