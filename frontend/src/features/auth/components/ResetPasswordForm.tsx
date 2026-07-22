import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_HINT,
  validatePassword,
  validatePasswordConfirmation,
} from '../utils/passwordValidation';

interface Props {
  onSubmit: (password: string) => void;
  loading: boolean;
  error: string;
}

export function ResetPasswordForm({ onSubmit, loading, error }: Props) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Per-field messages for the password rules. Populated when the user leaves a field (onBlur) and
  // kept in sync afterwards (onChange) so the message clears as soon as the value becomes valid.
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setNewPassword(value);
    // Re-validate live only once a message is already shown, so we never flag a field the user is
    // still typing into for the first time.
    if (passwordError) setPasswordError(validatePassword(value) ?? '');
    if (confirmError) setConfirmError(validatePasswordConfirmation(value, confirmPassword) ?? '');
  }

  function handleConfirmChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setConfirmPassword(value);
    if (confirmError) setConfirmError(validatePasswordConfirmation(newPassword, value) ?? '');
  }

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    const passwordMessage = validatePassword(newPassword);
    const confirmMessage = validatePasswordConfirmation(newPassword, confirmPassword);
    if (passwordMessage || confirmMessage) {
      setPasswordError(passwordMessage ?? '');
      setConfirmError(confirmMessage ?? '');
      return;
    }
    setPasswordError('');
    setConfirmError('');
    onSubmit(newPassword);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Input
        label="Nouveau mot de passe"
        type="password"
        placeholder="••••••••"
        value={newPassword}
        onChange={handlePasswordChange}
        onBlur={() => {
          setPasswordError(validatePassword(newPassword) ?? '');
          if (confirmPassword) setConfirmError(validatePasswordConfirmation(newPassword, confirmPassword) ?? '');
        }}
        required
        autoComplete="new-password"
        autoFocus
        minLength={PASSWORD_MIN_LENGTH}
        error={passwordError}
      />
      <Input
        label="Confirmer le mot de passe"
        type="password"
        placeholder="••••••••"
        value={confirmPassword}
        onChange={handleConfirmChange}
        onBlur={() => setConfirmError(validatePasswordConfirmation(newPassword, confirmPassword) ?? '')}
        required
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        error={confirmError}
      />

      {!passwordError && (
        <p className="text-xs text-taupe-400">{PASSWORD_POLICY_HINT}</p>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <Button type="submit" loading={loading} className="w-full mt-1">
        Réinitialiser le mot de passe
      </Button>
    </form>
  );
}
