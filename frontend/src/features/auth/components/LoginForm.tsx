import { useState } from 'react';
import { Link } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

interface Props {
  onSubmit: (email: string, password: string) => void;
  loading: boolean;
  error: string;
  /** Whether the server is reachable. Signing in verifies the password server-side, so it cannot proceed without it. */
  isOnline: boolean;
}

export function LoginForm({ onSubmit, loading, error, isOnline }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    onSubmit(email, password);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 flex-1">
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
          <Link to="/forgot-password" className="text-sm text-petrol-600 hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {!isOnline && (
        <p
          role="status"
          aria-live="polite"
          className="flex items-start gap-2 rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-taupe-600"
        >
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-taupe-500" />
          <span>
            Connexion au serveur indisponible. La vérification du mot de passe l'exige : reconnectez-vous
            à Internet pour accéder à votre espace. Vos données enregistrées sur cet appareil sont
            conservées.
          </span>
        </p>
      )}

      <Button
        type="submit"
        variant="secondary"
        loading={loading}
        disabled={!isOnline}
        className="w-full mt-auto"
      >
        Se connecter
      </Button>
    </form>
  );
}
