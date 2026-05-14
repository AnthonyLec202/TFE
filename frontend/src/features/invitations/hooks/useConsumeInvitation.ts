import { useState } from 'react';
import { consumeInvitation } from '../../../services/invitationService';

export interface UseConsumeInvitationResult {
  loading: boolean;
  error: string;
  consume: (code: string) => Promise<void>;
  reset: () => void;
}

export function useConsumeInvitation(): UseConsumeInvitationResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function consume(code: string) {
    setError('');
    setLoading(true);
    try {
      await consumeInvitation(code.toUpperCase().trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
      throw err; // rethrow so the container knows the call failed
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setLoading(false);
    setError('');
  }

  return { loading, error, consume, reset };
}
