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
  id: string;           // client-generated UUID, so the record is linkable before it syncs
  firstName: string;
  lastName: string;
  birthDate: string;    // ISO date "YYYY-MM-DD"
}

export interface InvitationResponse {
  plainSecretCode: string;
  expiresAt: string;    // ISO datetime
}

export interface CareTeamMemberResponse {
  userId: string;
  firstName: string;
  lastName: string;
  role: PatientUserRole;   // 'Admin' | 'Parent' | 'Collaborator'
  relationship: string;    // display-only label (e.g. "Neuropsychologue", "Teacher")
}
