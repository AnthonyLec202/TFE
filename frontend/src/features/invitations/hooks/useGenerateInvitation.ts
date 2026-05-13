import { useState } from 'react';
import { generateInvitation } from '../../../services/patientService';
import type { InvitationResponse } from '../../../types/patient';

export interface UseGenerateInvitationResult {
  generating: boolean;
  invitation: InvitationResponse | null;
  error: string;
  copied: boolean;
  generate: (patientId: string, role: string) => Promise<void>;
  copyToClipboard: () => Promise<void>;
  reset: () => void;
}

export function useGenerateInvitation(): UseGenerateInvitationResult {
  const [generating, setGenerating] = useState(false);
  const [invitation, setInvitation] = useState<InvitationResponse | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function generate(patientId: string, role: string) {
    setError('');
    setGenerating(true);
    try {
      setInvitation(await generateInvitation(patientId, role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setGenerating(false);
    }
  }

  async function copyToClipboard() {
    if (!invitation) return;
    await navigator.clipboard.writeText(invitation.plainSecretCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function reset() {
    setGenerating(false);
    setInvitation(null);
    setError('');
    setCopied(false);
  }

  return { generating, invitation, error, copied, generate, copyToClipboard, reset };
}
