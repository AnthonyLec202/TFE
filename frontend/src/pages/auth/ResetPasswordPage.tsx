import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { ResetPasswordContainer } from '../../features/auth';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = searchParams.get('email');
  const token = searchParams.get('token');

  if (!email || !token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <Card className="p-6 flex flex-col items-center gap-4 text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50">
              <TriangleAlert className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Lien de réinitialisation invalide.</p>
              <p className="mt-1 text-sm text-slate-500">
                Ce lien est manquant ou a expiré. Veuillez en demander un nouveau.
              </p>
            </div>
            <Link
              to="/forgot-password"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 font-medium hover:underline"
            >
              Demander un nouveau lien
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm mb-4">
            <ShieldCheck className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Créer un nouveau mot de passe</h1>
          <p className="mt-1 text-sm text-slate-500">
            Choisissez un mot de passe sécurisé pour votre compte.
          </p>
        </div>

        <Card className="p-6">
          <ResetPasswordContainer
            email={email}
            token={token}
            onSuccess={() => navigate('/login')}
          />
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
