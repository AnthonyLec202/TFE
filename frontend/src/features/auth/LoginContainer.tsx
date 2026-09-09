import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useGlobalNetworkState } from '../../core/offline/hooks/useGlobalNetworkState';
import { LoginForm } from './components/LoginForm';

interface Props {
  onSuccess: () => void;
}

export function LoginContainer({ onSuccess }: Props) {
  const { login } = useAuth();
  // Signing in is the one operation this application cannot do on its own: the password is verified
  // by the server. Surfaced up front rather than left to fail — a clinician whose offline session has
  // run out would otherwise type their password and get a generic network error back.
  const isOnline = useGlobalNetworkState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(email: string, password: string) {
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  return <LoginForm onSubmit={handleSubmit} loading={loading} error={error} isOnline={isOnline} />;
}
