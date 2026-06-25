// Role-based terminology for the patient views. A psychologist (the managing "Admin" of a dossier)
// owns "patients"; every other role is a collaborator who works on shared "dossiers". The UI strings
// diverge accordingly, so this single dictionary is the source of truth for that wording — components
// never hard-code "Mes patients" / "Mes dossiers" inline.

export type TerminologyProfile = 'psychologist' | 'collaborator';

export interface PatientTerminology {
  /** Navbar tab + dashboard page title. */
  nav_patients: string;
  /** Bare list heading (e.g. "patients suivis"). */
  list_title: string;
  /** Pluralised count subtitle, grammatically agreeing with `count`. */
  list_count: (count: number) => string;
  /** Invitation card title + action button. */
  join_action: string;
  /** Invitation card description (identical across profiles, kept here for completeness). */
  join_desc: string;
  /** Search field placeholder. */
  search_placeholder: string;
  /** Dossier back-arrow label when returning to the (non-archived) list. */
  back_label_patients: string;
}

const PSYCHOLOGIST: PatientTerminology = {
  nav_patients: 'Mes patients',
  list_title: 'patients suivis',
  list_count: count => `${count} patient${count !== 1 ? 's' : ''} suivi${count !== 1 ? 's' : ''}`,
  join_action: 'Rejoindre un patient',
  join_desc: "Utilisez un code d'invitation pour accéder au dossier d'un patient.",
  search_placeholder: 'Rechercher un patient par nom…',
  back_label_patients: 'Mes patients',
};

const COLLABORATOR: PatientTerminology = {
  nav_patients: 'Mes dossiers',
  list_title: 'Dossiers suivis',
  list_count: count => `${count} dossier${count !== 1 ? 's' : ''} suivi${count !== 1 ? 's' : ''}`,
  join_action: 'Rejoindre un dossier patient',
  join_desc: "Utilisez un code d'invitation pour accéder au dossier d'un patient.",
  search_placeholder: 'Rechercher un dossier patient par nom…',
  back_label_patients: 'Mes dossiers',
};

/** Maps the authenticated user's "is managing psychologist" flag onto a terminology profile. */
export function resolveTerminologyProfile(isPsychologist: boolean): TerminologyProfile {
  return isPsychologist ? 'psychologist' : 'collaborator';
}

/** Returns the terminology bundle for the user's profile. `isPsychologist` is the `Admin` role flag. */
export function getPatientTerminology(isPsychologist: boolean): PatientTerminology {
  return isPsychologist ? PSYCHOLOGIST : COLLABORATOR;
}
