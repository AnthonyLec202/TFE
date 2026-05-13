import { type FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Brain, KeyRound, LogIn } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import type { ConsumeTokenRequest } from '../../types/auth';

const EMPTY_ENROLL: ConsumeTokenRequest = {
  secretCode: '',
  firstName: '',
  lastName: '',
  email: '',
  password: '',
};

export function WelcomeView() {
  const { isAuthenticated, login, enroll } = useAuth();
  const navigate = useNavigate();

  const [enrollForm, setEnrollForm] = useState<ConsumeTokenRequest>(EMPTY_ENROLL);
  const [enrollError, setEnrollError] = useState('');
  const [enrollLoading, setEnrollLoading] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  function setEnrollField(field: keyof ConsumeTokenRequest) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setEnrollForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  async function handleEnroll(e: FormEvent) {
    e.preventDefault();
    setEnrollError('');
    setEnrollLoading(true);
    try {
      await enroll({ ...enrollForm, secretCode: enrollForm.secretCode.toUpperCase().trim() });
      navigate('/');
    } catch (err) {
      setEnrollError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setEnrollLoading(false);
    }
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      await login(loginEmail, loginPassword);
      navigate('/');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoginLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-8">

      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm mb-4">
          <Brain className="h-6 w-6 text-blue-600" />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">NeuroPlatform</h1>
        <p className="mt-1 text-sm text-slate-500">Plateforme collaborative de suivi psychologique</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-4xl bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2">

          {/* ── LEFT: Enrollment ─────────────────────────────────────────── */}
          <form onSubmit={handleEnroll} className="p-8 flex flex-col gap-6">

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-blue-600 shrink-0" />
                <h2 className="text-base font-semibold text-slate-900">
                  J'ai un code d'invitation
                </h2>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                Un code d'invitation vous a été transmis.
              </p>
            </div>

            {/* Prominent code input */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">
                Code d'invitation
              </label>
              <input
                type="text"
                value={enrollForm.secretCode}
                onChange={setEnrollField('secretCode')}
                placeholder="A3F9K2Z1"
                maxLength={8}
                required
                autoComplete="off"
                className="w-full rounded-xl border-2 border-blue-100 bg-blue-50 px-4 py-4 text-center text-2xl font-mono tracking-widest uppercase text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
              />
              <p className="text-xs text-center text-slate-400">
                8 caractères alphanumériques
              </p>
            </div>

            {/* Section break */}
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-slate-100" />
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Créez votre compte
              </span>
              <div className="flex-1 border-t border-slate-100" />
            </div>

            {/* Account details */}
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Prénom"
                  type="text"
                  placeholder="Marie"
                  value={enrollForm.firstName}
                  onChange={setEnrollField('firstName')}
                  required
                  autoComplete="given-name"
                />
                <Input
                  label="Nom"
                  type="text"
                  placeholder="Dupont"
                  value={enrollForm.lastName}
                  onChange={setEnrollField('lastName')}
                  required
                  autoComplete="family-name"
                />
              </div>
              <Input
                label="Adresse e-mail"
                type="email"
                placeholder="prenom.nom@exemple.com"
                value={enrollForm.email}
                onChange={setEnrollField('email')}
                required
                autoComplete="email"
              />
              <Input
                label="Mot de passe"
                type="password"
                placeholder="••••••••"
                value={enrollForm.password}
                onChange={setEnrollField('password')}
                required
                autoComplete="new-password"
                minLength={6}
              />
            </div>

            {enrollError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {enrollError}
              </p>
            )}

            <Button type="submit" loading={enrollLoading} className="w-full">
              Activer mon accès
            </Button>
          </form>

          {/* ── RIGHT: Login ─────────────────────────────────────────────── */}
          <form
            onSubmit={handleLogin}
            className="p-8 flex flex-col gap-6 border-t md:border-t-0 md:border-l border-slate-200"
          >
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <LogIn className="h-4 w-4 text-slate-500 shrink-0" />
                <h2 className="text-base font-semibold text-slate-900">
                  J'ai déjà un compte
                </h2>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                Accédez à votre espace NeuroPlatform.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Input
                label="Adresse e-mail"
                type="email"
                placeholder="prenom.nom@exemple.com"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <div className="flex flex-col gap-1">
                <Input
                  label="Mot de passe"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <div className="flex justify-end">
                  <Link
                    to="/forgot-password"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Mot de passe oublié ?
                  </Link>
                </div>
              </div>
            </div>

            {loginError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {loginError}
              </p>
            )}

            <Button
              type="submit"
              variant="secondary"
              loading={loginLoading}
              className="w-full"
            >
              Se connecter
            </Button>
          </form>

        </div>
      </div>

    </div>
  );
}
