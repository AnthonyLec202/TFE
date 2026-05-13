import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, ShieldCheck, TriangleAlert } from 'lucide-react';
import { resetPassword } from '../../services/authService';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';

export function ResetPasswordView() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Guard: the link must carry both params
  if (!email || !token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <Card className="p-6 flex flex-col items-center gap-4 text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50">
              <TriangleAlert className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Lien de réinitialisation invalide.</p>
              <p className="mt-1 text-sm text-slate-500">
                Ce lien est manquant ou a expiré. Veuillez en demander un nouveau.
              </p>
            </div>
            <Link
              to="/forgot-password"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 font-medium hover:underline"
            >
              Demander un nouveau lien
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email!, token!, newPassword);
      setSuccess(true);
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
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm mb-4">
            <ShieldCheck className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Créer un nouveau mot de passe</h1>
          <p className="mt-1 text-sm text-slate-500">
            Choisissez un mot de passe sécurisé pour votre compte.
          </p>
        </div>

        <Card className="p-6">
          {success ? (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Votre mot de passe a été réinitialisé avec succès.
              </p>
              <Link to="/login">
                <Button variant="secondary" className="mt-1">
                  Se connecter
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="Nouveau mot de passe"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                autoFocus
                minLength={8}
              />
              <Input
                label="Confirmer le mot de passe"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
              />

              <p className="text-xs text-slate-400">
                Minimum 8 caractères, avec majuscule, minuscule, chiffre et caractère spécial.
              </p>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button type="submit" loading={loading} className="w-full mt-1">
                Réinitialiser le mot de passe
              </Button>
            </form>
          )}
        </Card>

        {!success && (
          <p className="mt-4 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour à la connexion
            </Link>
          </p>
        )}

      </div>
    </div>
  );
}
