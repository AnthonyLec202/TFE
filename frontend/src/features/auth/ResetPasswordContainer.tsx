import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { resetPassword } from '../../services/authService';
import { Button } from '../../components/ui/Button';
import { ResetPasswordForm } from './components/ResetPasswordForm';

interface Props {
  email: string;
  token: string;
  onSuccess: () => void;
}

export function ResetPasswordContainer({ email, token, onSuccess }: Props) {
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

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50">
          <CheckCircle className="h-6 w-6 text-emerald-600" />
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          Votre mot de passe a été réinitialisé avec succès.
        </p>
        <Button variant="secondary" className="mt-1" onClick={onSuccess}>
          Se connecter
        </Button>
      </div>
    );
  }

  return <ResetPasswordForm onSubmit={handleSubmit} loading={loading} error={error} />;
}
