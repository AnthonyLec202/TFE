import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

interface Props {
  onSubmit: (email: string, password: string) => void;
  loading: boolean;
  error: string;
}

export function LoginForm({ onSubmit, loading, error }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    onSubmit(email, password);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input
        label="Adresse e-mail"
        type="email"
        placeholder="prenom.nom@exemple.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        autoComplete="email"
      />
      <div className="flex flex-col gap-1">
        <Input
          label="Mot de passe"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <Button type="submit" variant="secondary" loading={loading} className="w-full">
        Se connecter
      </Button>
    </form>
  );
}
