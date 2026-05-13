import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import type { ConsumeTokenRequest } from '../../types/auth';

const EMPTY_FORM: ConsumeTokenRequest = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  secretCode: '',
};

export function EnrollmentView() {
  const { enroll } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<ConsumeTokenRequest>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function setField(field: keyof ConsumeTokenRequest) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await enroll({ ...form, secretCode: form.secretCode.toUpperCase() });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 mb-4">
            <KeyRound className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Activer mon accès</h1>
          <p className="mt-1 text-sm text-slate-500">
            Créez votre compte avec le code reçu du psychologue
          </p>
        </div>

        <Card className="p-6">
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
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" loading={loading} className="w-full mt-1">
              Créer mon compte
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-sm text-slate-500">
          Déjà inscrit ?{' '}
          <Link to="/login" className="text-blue-600 font-medium hover:underline">
            Se connecter
          </Link>
        </p>

      </div>
    </div>
  );
}
