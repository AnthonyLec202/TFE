import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { EnrollmentForm } from './components/EnrollmentForm';
import type { ConsumeTokenRequest } from '../../types/auth';

interface Props {
  initialCode: string;
  onSuccess: () => void;
}

export function EnrollmentContainer({ initialCode, onSuccess }: Props) {
  const { enroll } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(data: ConsumeTokenRequest) {
    setError('');
    setLoading(true);
    try {
      await enroll(data);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  return <EnrollmentForm initialCode={initialCode} onSubmit={handleSubmit} loading={loading} error={error} />;
}
