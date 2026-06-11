import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import type { ConsumeTokenRequest } from '../../../types/auth';

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

  function setField(field: keyof ConsumeTokenRequest) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();

    if (form.password !== confirmPassword) {
      setValidationError('Les mots de passe ne correspondent pas.');
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
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
        onChange={setField('email')}
        required
        autoComplete="email"
      />

      <Input
        label="Choisissez un mot de passe"
        type="password"
        placeholder="••••••••"
        value={form.password}
        onChange={setField('password')}
        required
        autoComplete="new-password"
        minLength={6}
      />

      <Input
        label="Confirmer le mot de passe"
        type="password"
        placeholder="••••••••"
        value={confirmPassword}
        onChange={e => setConfirmPassword(e.target.value)}
        required
        autoComplete="new-password"
        minLength={6}
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

      <Button type="submit" loading={loading} disabled={!form.consent} className="w-full mt-1">
        Créer mon compte
      </Button>
    </form>
  );
}
