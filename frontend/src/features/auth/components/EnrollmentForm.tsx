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
  const [form, setForm] = useState<ConsumeTokenRequest>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    secretCode: initialCode,
  });

  function setField(field: keyof ConsumeTokenRequest) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    onSubmit({ ...form, secretCode: form.secretCode.toUpperCase().trim() });
  }

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

      <div className="pt-1 border-t border-slate-100">
        <Input
          label="Code d'invitation"
          type="text"
          placeholder="EX : A3F9K2Z1"
          value={form.secretCode}
          onChange={setField('secretCode')}
          required
          maxLength={8}
          className="font-mono tracking-widest uppercase"
        />
        <p className="mt-1.5 text-xs text-slate-400">
          Code à 8 caractères fourni par le psychologue
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <Button type="submit" loading={loading} className="w-full mt-1">
        Créer mon compte
      </Button>
    </form>
  );
}
