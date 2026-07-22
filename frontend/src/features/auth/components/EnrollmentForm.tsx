import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import type { ConsumeTokenRequest } from '../../../types/auth';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_HINT,
  validatePassword,
  validatePasswordConfirmation,
} from '../utils/passwordValidation';
import { validateEmail } from '../utils/emailValidation';

interface Props {
  initialCode: string;
  onSubmit: (data: ConsumeTokenRequest) => void;
  loading: boolean;
  error: string;
}

export function EnrollmentForm({ initialCode, onSubmit, loading, error }: Props) {
  // The invitation code was already entered and validated at the previous step; it is kept in
  // state so it travels with the submission, but it is no longer shown as an editable field.
  const [form, setForm] = useState<ConsumeTokenRequest>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    secretCode: initialCode,
    consent: false,
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');
  // Per-field messages for the password formatting rules. Populated when the user leaves a field
  // (onBlur) and kept in sync afterwards (onChange) so the message clears as soon as the value
  // becomes valid.
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [emailError, setEmailError] = useState('');

  function setField(field: keyof ConsumeTokenRequest) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setForm(prev => ({ ...prev, email: value }));
    if (emailError) setEmailError(validateEmail(value) ?? '');
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setForm(prev => ({ ...prev, password: value }));
    // Re-validate live only once a message is already shown, so we never flag a field the user is
    // still typing into for the first time.
    if (passwordError) setPasswordError(validatePassword(value) ?? '');
    if (confirmError) setConfirmError(validatePasswordConfirmation(value, confirmPassword) ?? '');
  }

  function handleConfirmChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setConfirmPassword(value);
    if (confirmError) setConfirmError(validatePasswordConfirmation(form.password, value) ?? '');
  }

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();

    const emailMessage = validateEmail(form.email);
    const passwordMessage = validatePassword(form.password);
    const confirmMessage = validatePasswordConfirmation(form.password, confirmPassword);
    if (emailMessage || passwordMessage || confirmMessage) {
      setEmailError(emailMessage ?? '');
      setPasswordError(passwordMessage ?? '');
      setConfirmError(confirmMessage ?? '');
      return;
    }
    if (!form.consent) {
      setValidationError('Vous devez accepter la collecte des données pour créer un compte.');
      return;
    }

    setValidationError('');
    onSubmit({ ...form, secretCode: form.secretCode.toUpperCase().trim() });
  }

  const displayError = validationError || error;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Prénom"
          type="text"
          placeholder="Marie"
          value={form.firstName}
          onChange={setField('firstName')}
          required
          autoComplete="given-name"
          autoFocus
        />
        <Input
          label="Nom"
          type="text"
          placeholder="Dupont"
          value={form.lastName}
          onChange={setField('lastName')}
          required
          autoComplete="family-name"
        />
      </div>

      <Input
        label="Adresse e-mail"
        type="email"
        placeholder="prenom.nom@exemple.com"
        value={form.email}
        onChange={handleEmailChange}
        onBlur={() => setEmailError(validateEmail(form.email) ?? '')}
        required
        autoComplete="email"
        error={emailError}
      />

      <Input
        label="Choisissez un mot de passe"
        type="password"
        placeholder="••••••••"
        value={form.password}
        onChange={handlePasswordChange}
        onBlur={() => {
          setPasswordError(validatePassword(form.password) ?? '');
          if (confirmPassword) setConfirmError(validatePasswordConfirmation(form.password, confirmPassword) ?? '');
        }}
        required
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        error={passwordError}
      />
      {!passwordError && (
        <p className="-mt-2 text-xs text-slate-400">{PASSWORD_POLICY_HINT}</p>
      )}

      <Input
        label="Confirmer le mot de passe"
        type="password"
        placeholder="••••••••"
        value={confirmPassword}
        onChange={handleConfirmChange}
        onBlur={() => setConfirmError(validatePasswordConfirmation(form.password, confirmPassword) ?? '')}
        required
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        error={confirmError}
      />

      <label className="flex items-start gap-2.5 text-xs text-slate-500 leading-relaxed cursor-pointer">
        <input
          type="checkbox"
          checked={form.consent}
          onChange={e => setForm(prev => ({ ...prev, consent: e.target.checked }))}
          required
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span>
          J'accepte la collecte et le traitement de mes données personnelles dans le cadre du suivi.
          Je peux supprimer mon compte à tout moment&nbsp;; mes données seront alors anonymisées.
        </span>
      </label>

      {displayError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{displayError}</p>
      )}

      <Button
        type="submit"
        loading={loading}
        disabled={
          !form.consent ||
          !form.firstName.trim() ||
          !form.lastName.trim() ||
          !form.email.trim() ||
          !form.password ||
          !confirmPassword
        }
        className="w-full mt-1"
      >
        Créer mon compte
      </Button>
    </form>
  );
}
