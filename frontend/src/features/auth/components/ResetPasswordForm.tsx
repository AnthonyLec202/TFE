import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

interface Props {
  onSubmit: (password: string) => void;
  loading: boolean;
  error: string;
}

export function ResetPasswordForm({ onSubmit, loading, error }: Props) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setValidationError('Les mots de passe ne correspondent pas.');
      return;
    }
    setValidationError('');
    onSubmit(newPassword);
  }

  const displayError = validationError || error;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Nouveau mot de passe"
        type="password"
        placeholder="••••••••"
        value={newPassword}
        onChange={e => setNewPassword(e.target.value)}
        required
        autoComplete="new-password"
        autoFocus
        minLength={8}
      />
      <Input
        label="Confirmer le mot de passe"
        type="password"
        placeholder="••••••••"
        value={confirmPassword}
        onChange={e => setConfirmPassword(e.target.value)}
        required
        autoComplete="new-password"
        minLength={8}
      />

      <p className="text-xs text-taupe-400">
        Minimum 8 caractères, avec majuscule, minuscule, chiffre et caractère spécial.
      </p>

      {displayError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{displayError}</p>
      )}

      <Button type="submit" loading={loading} className="w-full mt-1">
        Réinitialiser le mot de passe
      </Button>
    </form>
  );
}
