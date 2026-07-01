import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { forgotPassword } from '../../services/authService';
import { ForgotPasswordForm } from './components/ForgotPasswordForm';

export function ForgotPasswordContainer() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(email: string) {
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email);
      setSubmitted(true);
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50">
          <CheckCircle className="h-6 w-6 text-emerald-600" />
        </div>
        <p className="text-sm text-taupe-500 leading-relaxed">
          Si cette adresse correspond à un compte, un e-mail contenant un lien de
          réinitialisation vient de vous être envoyé.
        </p>
      </div>
    );
  }

  return <ForgotPasswordForm onSubmit={handleSubmit} loading={loading} error={error} />;
}
