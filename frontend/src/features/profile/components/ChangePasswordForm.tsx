import { useEffect, useState, type SubmitEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

interface Props {
  onSubmit: (currentPassword: string, newPassword: string) => void;
  loading: boolean;
  error: string;
  success: boolean;
}

export function ChangePasswordForm({ onSubmit, loading, error, success }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  // Clear the fields once the change has succeeded.
  useEffect(() => {
    if (success) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [success]);

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setValidationError('Les mots de passe ne correspondent pas.');
      return;
    }
    setValidationError('');
    onSubmit(currentPassword, newPassword);
  }

  const displayError = validationError || error;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Mot de passe actuel"
        type="password"
        placeholder="••••••••"
        value={currentPassword}
        onChange={e => setCurrentPassword(e.target.value)}
        required
        autoComplete="current-password"
      />
      <Input
        label="Nouveau mot de passe"
        type="password"
        placeholder="••••••••"
        value={newPassword}
        onChange={e => setNewPassword(e.target.value)}
        required
        autoComplete="new-password"
        minLength={8}
      />
      <Input
        label="Confirmer le nouveau mot de passe"
        type="password"
        placeholder="••••••••"
        value={confirmPassword}
        onChange={e => setConfirmPassword(e.target.value)}
        required
        autoComplete="new-password"
        minLength={8}
      />

      <p className="text-xs text-slate-400">
        Minimum 8 caractères, avec majuscule, minuscule, chiffre et caractère spécial.
      </p>

      {displayError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {displayError}
        </p>
      )}
      {success && !displayError && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          Votre mot de passe a été modifié avec succès.
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          loading={loading}
          disabled={!currentPassword || !newPassword || !confirmPassword}
        >
          Modifier le mot de passe
        </Button>
      </div>
    </form>
  );
}
