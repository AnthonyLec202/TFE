import { Navigate, useNavigate } from 'react-router-dom';
import { Brain, KeyRound, LogIn } from 'lucide-react';
import { useAuth, LoginContainer, ValidateCodeForm } from '../../features/auth';

export function WelcomePage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated) return <Navigate to="/" replace />;

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

          {/* ── LEFT: Validate code ───────────────────────────────────────── */}
          <div className="p-8 flex flex-col gap-6">
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
            <ValidateCodeForm
              onSubmit={code => navigate(`/enroll?code=${encodeURIComponent(code)}`)}
            />
          </div>

          {/* ── RIGHT: Login ──────────────────────────────────────────────── */}
          <div className="p-8 flex flex-col gap-6 border-t md:border-t-0 md:border-l border-slate-200">
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
            <LoginContainer onSuccess={() => navigate('/')} />
          </div>

        </div>
      </div>

    </div>
  );
}
