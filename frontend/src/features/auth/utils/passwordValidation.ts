// Client-side password policy. Deliberately simple — a single rule (minimum length) — to stay
// accessible to users who are not comfortable with technology. This mirrors the relaxed backend
// ASP.NET Core Identity policy (RequiredLength = 6, all complexity rules disabled), so a password
// accepted here is also accepted by the server.

/** Minimum password length enforced on the client (mirrors the backend RequiredLength). */
export const PASSWORD_MIN_LENGTH = 6;

/** Human-readable summary of the policy, shown as a hint below password fields. */
export const PASSWORD_POLICY_HINT = `Minimum ${PASSWORD_MIN_LENGTH} caractères.`;

/**
 * Validates a password against the security policy. Returns a French message describing the unmet
 * rule, or null when the password is valid.
 */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  }
  return null;
}

/**
 * Validates that the confirmation field matches the password. Returns a French message when they
 * differ, or null when they match.
 */
export function validatePasswordConfirmation(password: string, confirmation: string): string | null {
  if (confirmation !== password) {
    return 'Les deux mots de passe ne correspondent pas.';
  }
  return null;
}
