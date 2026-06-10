// Pure formatting helpers for the Sessions feature. No React, no I/O.

/**
 * Formats an ISO date string ("2026-06-09") as "dd/mm/yyyy".
 * Parses the string directly to avoid timezone shifts introduced by `new Date()`.
 * Returns the original input unchanged if it is not a well-formed ISO date.
 */
export function formatSessionDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

/**
 * Resolves a session's patient IDs to their full "FirstName LastName" labels.
 * Falls back to a "N patient(s)" count string when no names can be resolved
 * (e.g. the local patient cache has not been synced yet).
 */
export function formatPatientNames(
  patientIds: string[],
  namesById: Map<string, string>,
): string {
  const names = patientIds
    .map(id => namesById.get(id))
    .filter((name): name is string => Boolean(name));

  if (names.length === 0) {
    return `${patientIds.length} patient${patientIds.length !== 1 ? 's' : ''}`;
  }

  return names.join(', ');
}
