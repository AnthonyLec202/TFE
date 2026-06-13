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
