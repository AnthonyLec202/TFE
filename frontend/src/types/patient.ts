export type PatientUserRole = 'Admin' | 'Parent' | 'Collaborator';

/**
 * The relationship a care-team member has to the patient — the single list shared by the invitation
 * dropdown and the collaborative wall's visibility selector.
 *
 * `value` is an API contract, not a display string: these are the backend `RelationshipType` enum
 * member names, persisted verbatim inside `Post.excludedRoles` (a text[] column) and compared there at
 * read time. Translating a `value` would orphan the exclusion list of every existing post. Only
 * `label` may be edited — it mirrors `CareTeamRoleLabels.ForRelationship` on the backend, and the two
 * must be changed together.
 *
 * Ordered to match the enum declaration so both sides read the same way.
 */
export const RELATIONSHIP_ROLES = [
  { value: 'Parent',               label: 'Parent' },
  { value: 'Teacher',              label: 'Enseignant(e)' },
  { value: 'SpeechTherapist',      label: 'Logopède' },
  { value: 'PsychomotorTherapist', label: 'Psychomotricien(ne)' },
  { value: 'Ergotherapist',        label: 'Ergothérapeute' },
  { value: 'Doctor',               label: 'Docteur' },
  { value: 'Other',                label: 'Autre' },
] as const;

export type RelationshipRoleValue = (typeof RELATIONSHIP_ROLES)[number]['value'];

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
  relationship: string;    // display-only French label (e.g. "Psychologue", "Enseignant(e)")
}
