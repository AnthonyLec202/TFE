import { Link, useSearchParams } from 'react-router-dom';
import { ShieldCheck, TriangleAlert } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { ResetPasswordContainer } from '../../features/auth';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');
  const token = searchParams.get('token');

  if (!email || !token) {
    return (
      <div className="min-h-screen bg-sand-50 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm">
          <Card className="p-6 flex flex-col items-center gap-4 text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50">
              <TriangleAlert className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="font-semibold text-ink">Lien de réinitialisation invalide.</p>
              <p className="mt-1 text-sm text-taupe-500">
                Ce lien est manquant ou a expiré. Veuillez en demander un nouveau.
              </p>
            </div>
            <Link
              to="/forgot-password"
              className="inline-flex items-center gap-1.5 text-sm text-petrol-600 font-medium hover:underline"
            >
              Demander un nouveau lien
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand-50 flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-petrol-600 shadow-sm mb-4">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <h1 className="font-serif text-[28px] font-semibold tracking-[-0.015em] text-ink">Créer un nouveau mot de passe</h1>
          <p className="mt-1 text-sm text-taupe-500">
            Choisissez un mot de passe sécurisé pour votre compte.
          </p>
        </div>

        <Card className="p-6">
          <ResetPasswordContainer email={email} token={token} />
        </Card>

      </div>
    </div>
  );
}
