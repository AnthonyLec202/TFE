import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { resetPassword } from '../../services/authService';
import { ResetPasswordForm } from './components/ResetPasswordForm';

interface Props {
  email: string;
  token: string;
}

export function ResetPasswordContainer({ email, token }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(password: string) {
    setError('');
    setLoading(true);
    try {
      await resetPassword(email, token, password);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  // Terminal confirmation: the user is intentionally NOT signed in here. They return to the original
  // tab (where they started the request) and log in from there with the new password.
  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50">
          <CheckCircle className="h-6 w-6 text-emerald-600" />
        </div>
        <p className="text-sm font-medium text-ink">
          Votre mot de passe a été modifié !
        </p>
        <p className="text-sm text-taupe-500 leading-relaxed">
          Vous pouvez quitter cet onglet et retourner à la fenêtre de connexion.
        </p>
      </div>
    );
  }

  return <ResetPasswordForm onSubmit={handleSubmit} loading={loading} error={error} />;
}
