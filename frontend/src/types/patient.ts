export type PatientUserRole = 'Admin' | 'Parent' | 'Collaborator';

export interface PatientResponse {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;    // ISO date "YYYY-MM-DD"
  userRole: PatientUserRole;
  // Optional contact details (null/absent until filled in via the dossier edit form).
  email?: string | null;
  phoneNumber?: string | null;
  postalAddress?: string | null;
  isArchived: boolean;  // archived patients are hidden from "Mes patients" and shown under "Archives"
}

export interface UpdatePatientPayload {
  firstName: string;
  lastName: string;
  birthDate: string;    // ISO date "YYYY-MM-DD"
  // Optional contact details — present only on the update path, never on creation.
  email?: string | null;
  phoneNumber?: string | null;
  postalAddress?: string | null;
  isArchived: boolean;
}

// Creation stays minimal: First Name, Last Name, Date of Birth only. Contact details are added later
// from the dossier, so they are intentionally absent here.
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
