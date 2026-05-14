import { Link } from 'react-router-dom';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { ForgotPasswordContainer } from '../../features/auth';

export function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm mb-4">
            <LockKeyhole className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Mot de passe oublié ?</h1>
          <p className="mt-1 text-sm text-slate-500">
            Entrez votre adresse e-mail pour recevoir un lien de réinitialisation.
          </p>
        </div>

        <Card className="p-6">
          <ForgotPasswordContainer />
        </Card>

        <p className="mt-4 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour à la connexion
          </Link>
        </p>

      </div>
    </div>
  );
}
