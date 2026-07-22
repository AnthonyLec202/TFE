import { useState, type SubmitEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_HINT,
  validatePassword,
  validatePasswordConfirmation,
} from '../../auth';

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
  // Per-field messages for the password formatting rules. Populated when the user leaves a field
  // (onBlur) and kept in sync afterwards (onChange) so the message clears as soon as the value
  // becomes valid.
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');

  // NOTE: The fields are not cleared here on success. Instead, the parent container remounts this
  // form (via a changing `key`) once the change succeeds, which resets all local state — avoiding a
  // setState-in-effect that would trigger cascading renders.

  function handleNewPasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setNewPassword(value);
    // Re-validate live only once a message is already shown, so we never flag a field the user is
    // still typing into for the first time.
    if (newPasswordError) setNewPasswordError(validatePassword(value) ?? '');
    if (confirmError) setConfirmError(validatePasswordConfirmation(value, confirmPassword) ?? '');
  }

  function handleConfirmChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setConfirmPassword(value);
    if (confirmError) setConfirmError(validatePasswordConfirmation(newPassword, value) ?? '');
  }

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const passwordMessage = validatePassword(newPassword);
    const confirmMessage = validatePasswordConfirmation(newPassword, confirmPassword);
    if (passwordMessage || confirmMessage) {
      setNewPasswordError(passwordMessage ?? '');
      setConfirmError(confirmMessage ?? '');
      return;
    }
    setNewPasswordError('');
    setConfirmError('');
    onSubmit(currentPassword, newPassword);
  }

  const displayError = error;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
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
        onChange={handleNewPasswordChange}
        onBlur={() => {
          setNewPasswordError(validatePassword(newPassword) ?? '');
          if (confirmPassword) setConfirmError(validatePasswordConfirmation(newPassword, confirmPassword) ?? '');
        }}
        required
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        error={newPasswordError}
      />
      {!newPasswordError && (
        <p className="-mt-2 text-xs text-slate-400">{PASSWORD_POLICY_HINT}</p>
      )}
      <Input
        label="Confirmer le nouveau mot de passe"
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
