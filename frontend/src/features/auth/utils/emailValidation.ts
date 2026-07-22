// Client-side e-mail format validation. Intentionally permissive: it rejects obviously malformed
// input (missing "@", missing domain, whitespace) without trying to fully enforce RFC 5322, which
// no simple regex does correctly. Definitive validation remains the server's responsibility.

// local-part@domain.tld — no whitespace, exactly one "@", and a dotted domain.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates the format of an e-mail address. Returns a French message when the value is present but
 * malformed, or null when it is empty (emptiness is left to the field's `required` attribute) or
 * correctly formatted.
 */
export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return 'Veuillez saisir une adresse e-mail valide (exemple : prenom.nom@exemple.com).';
  }
  return null;
}
