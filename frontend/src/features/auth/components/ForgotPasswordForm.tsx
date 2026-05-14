import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

interface Props {
  onSubmit: (email: string) => void;
  loading: boolean;
  error: string;
}

export function ForgotPasswordForm({ onSubmit, loading, error }: Props) {
  const [email, setEmail] = useState('');

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    onSubmit(email);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Adresse e-mail"
        type="email"
        placeholder="prenom.nom@exemple.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        autoComplete="email"
        autoFocus
      />

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <Button type="submit" loading={loading} className="w-full">
        Envoyer le lien
      </Button>
    </form>
  );
}
