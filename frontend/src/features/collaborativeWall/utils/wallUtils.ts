import type { PatientUserRole } from '../../../types/patient';

export const PURGED_CONTENT = 'Compte supprimé - Contenu invisible';

export const SPECIFIC_ROLES = [
  { value: 'Parent',          label: 'Parent' },
  { value: 'Teacher',         label: 'Enseignant(e)' },
  { value: 'SpeechTherapist', label: 'Logopède' },
  { value: 'Doctor',          label: 'Docteur' },
  { value: 'Ergotherapist',   label: 'Ergothérapeute' },
  { value: 'Other',           label: 'Autre' },
];

export const ALL_SPECIFIC_ROLE_VALUES = SPECIFIC_ROLES.map(r => r.value);

// Visible-by (whitelist) → ExcludedRoles (blacklist) for the API
export function whitelistToBlacklist(visibleRoles: string[]): string[] {
  if (visibleRoles.length === 0) return [];
  return ALL_SPECIFIC_ROLE_VALUES.filter(r => !visibleRoles.includes(r));
}

// ExcludedRoles (blacklist) → Visible-by (whitelist) for the UI
export function blacklistToWhitelist(excludedRoles: string[]): string[] {
  if (excludedRoles.length === 0) return [];
  return ALL_SPECIFIC_ROLE_VALUES.filter(r => !excludedRoles.includes(r));
}

export function canModify(
  createdAt: string,
  createdById: string | null,
  currentUserId: string,
  userRole: PatientUserRole,
): boolean {
  if (userRole === 'Admin') return true;
  if (!createdById || createdById !== currentUserId) return false;
  const hoursSince = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  return hoursSince <= 24;
}

export function formatPostDate(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `Le ${p.day} ${p.month} ${p.year} à ${p.hour}:${p.minute}`;
}

// Produces: "A. Dupont - Psychologue - Le 12 mai 2025 à 14:32"
// When author was deleted, produces: "Utilisateur supprimé - Le 12 mai 2025 à 14:32"
export function metaLabel(
  firstName: string,
  lastName: string,
  role: string,
  createdAt: string,
  updatedAt?: string,
): string {
  const isDeletedUser = !firstName && !lastName;
  const namePart = isDeletedUser ? 'Utilisateur supprimé' : (() => {
    const initial = firstName ? firstName.charAt(0).toUpperCase() + '.' : '';
    const fullName = lastName || '';
    return initial && fullName ? `${initial} ${fullName}` : initial || fullName;
  })();
  const rolePart = isDeletedUser ? '' : role;
  const parts = [namePart, rolePart].filter(Boolean).join(' - ');
  const separator = parts ? ' - ' : '';
  return `${parts}${separator}${formatPostDate(createdAt)}${updatedAt ? ' · modifié' : ''}`;
}

export function pillClass(active: boolean, isTous = false): string {
  return [
    'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium cursor-pointer border transition-colors select-none',
    active
      ? isTous
        ? 'bg-slate-800 text-white border-slate-800'
        : 'bg-blue-600 text-white border-blue-600'
      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400',
  ].join(' ');
}
