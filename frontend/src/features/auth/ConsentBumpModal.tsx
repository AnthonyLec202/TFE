import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { updateConsent } from '../../services/authService';
import { REQUIRED_CONSENT_VERSION } from '../../config/consent';
import { Button } from '../../components/ui/Button';

// ---------------------------------------------------------------------------
// Hardcoded policy text (placeholder — replace with final legal content).
// ---------------------------------------------------------------------------
const PRIVACY_POLICY_TEXT = `
Politique de Confidentialité & Conditions d'Utilisation — Version ${REQUIRED_CONSENT_VERSION}

1. Responsable du traitement
L'application est éditée dans le cadre d'un projet académique de suivi neuropsychologique. Les données collectées sont traitées sous la responsabilité de l'équipe soignante désignée pour chaque patient.

2. Données traitées
Sont collectées et traitées : les données d'identification (nom, prénom, adresse e-mail), les notes cliniques de séance, les données de présence aux séances, ainsi que les publications du mur collaboratif. Ces données sont classifiées comme données de santé au sens du RGPD (Art. 9).

3. Finalité du traitement
Les données sont traitées exclusivement dans le but d'assurer le suivi neuropsychologique des patients et de faciliter la collaboration entre membres de l'équipe soignante.

4. Base légale
Le traitement repose sur le consentement explicite de l'utilisateur (Art. 6(1)(a) et Art. 9(2)(a) RGPD), recueilli lors de l'inscription et lors de toute mise à jour significative de la présente politique.

5. Durée de conservation
Les données sont conservées pendant la durée active du suivi du patient. À la demande de l'utilisateur, son compte est supprimé et les données publiées sont anonymisées conformément au droit à l'effacement (Art. 17 RGPD).

6. Sécurité
Les données cliniques sont chiffrées au niveau du champ en base de données. Les communications sont sécurisées via HTTPS. L'authentification repose sur un jeton JWT stocké exclusivement dans un cookie HttpOnly, inaccessible au JavaScript.

7. Droits des utilisateurs
Vous disposez du droit d'accès, de rectification, d'effacement, de limitation du traitement et de portabilité de vos données. Pour exercer ces droits, contactez l'administrateur de l'application.

8. Modifications
Toute modification substantielle de cette politique entraîne une nouvelle demande de consentement explicite à la prochaine connexion.
`.trim();

// ---------------------------------------------------------------------------
// ConsentBumpModal
// Renders as a full-screen blocking overlay whenever the authenticated user's
// recorded ConsentVersion does not match REQUIRED_CONSENT_VERSION. No underlying
// route or navigation element is interactive while this modal is mounted.
// ---------------------------------------------------------------------------
export function ConsentBumpModal() {
  const { user, patchUser } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const requiresBump =
    user !== null && user.consentVersion !== REQUIRED_CONSENT_VERSION;

  if (!requiresBump) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accepted) return;

    setError('');
    setIsSubmitting(true);
    try {
      await updateConsent(REQUIRED_CONSENT_VERSION);
      // Patch the in-memory user so the modal unmounts immediately without
      // waiting for a full session refresh from the server.
      patchUser({
        consentVersion: REQUIRED_CONSENT_VERSION,
        consentGivenAt: new Date().toISOString(),
      });
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-modal-title"
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-200">
          <h1
            id="consent-modal-title"
            className="text-lg font-semibold text-slate-900"
          >
            Mise à jour des Conditions d'Utilisation
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Notre politique de confidentialité a été mise à jour. Veuillez en
            prendre connaissance et confirmer votre acceptation pour continuer.
          </p>
        </div>

        {/* Scrollable policy body */}
        <div className="px-6 py-4 overflow-y-auto max-h-80 bg-slate-50 text-sm text-slate-700 leading-relaxed whitespace-pre-line border-b border-slate-200">
          {PRIVACY_POLICY_TEXT}
        </div>

        {/* Acceptance form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={accepted}
              onChange={e => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-blue-600"
            />
            <span className="text-sm text-slate-700">
              J'ai lu et j'accepte les nouvelles Conditions d'Utilisation et je
              consens expressément au traitement de mes données personnelles et
              de santé dans le cadre du suivi neuropsychologique, conformément
              à la Politique de Confidentialité.
            </span>
          </label>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!accepted || isSubmitting}
              loading={isSubmitting}
            >
              Confirmer et accéder à l'application
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
