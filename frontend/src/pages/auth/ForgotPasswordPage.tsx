import { Link } from 'react-router-dom';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { ForgotPasswordContainer } from '../../features/auth';

export function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-sand-50 flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-petrol-600 shadow-sm mb-4">
            <LockKeyhole className="h-6 w-6 text-white" />
          </div>
          <h1 className="font-serif text-[28px] font-semibold tracking-[-0.015em] text-ink">Mot de passe oublié ?</h1>
          <p className="mt-1 text-sm text-taupe-500">
            Entrez votre adresse e-mail pour recevoir un lien de réinitialisation.
          </p>
        </div>

        <Card className="p-6">
          <ForgotPasswordContainer />
        </Card>

        <p className="mt-4 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm text-taupe-500 hover:text-ink transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour à la connexion
          </Link>
        </p>

      </div>
    </div>
  );
}
