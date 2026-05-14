import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { EnrollmentContainer } from '../../features/auth';

export function EnrollmentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get('code') ?? '';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 mb-4">
            <KeyRound className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Activer mon accès</h1>
          <p className="mt-1 text-sm text-slate-500">
            Créez votre compte avec le code reçu du psychologue
          </p>
        </div>

        <Card className="p-6">
          <EnrollmentContainer initialCode={code} onSuccess={() => navigate('/')} />
        </Card>

        <p className="mt-4 text-center text-sm text-slate-500">
          Déjà inscrit ?{' '}
          <Link to="/login" className="text-blue-600 font-medium hover:underline">
            Se connecter
          </Link>
        </p>

      </div>
    </div>
  );
}
