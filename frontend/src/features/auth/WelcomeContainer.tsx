import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, LogIn } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { LoginContainer } from './LoginContainer';
import { ValidateCodeForm } from './components/ValidateCodeForm';
import { FullScreenLoader } from '../../components/ui/FullScreenLoader';

export function WelcomeContainer() {
  const { isAuthenticated, isInitialized } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Where to land once signed in: the page that sent us here, or the dashboard. Validated rather
  // than trusted — history state is caller-controlled, and only a same-site absolute path may be
  // navigated to. "//host" is rejected explicitly: the browser reads it as a protocol-relative URL.
  const requested = (location.state as { from?: unknown } | null)?.from;
  const redirectTo =
    typeof requested === 'string' && requested.startsWith('/') && !requested.startsWith('//')
      ? requested
      : '/';

  // Same reason as the route guard: until the session restore settles, showing the login form to
  // someone who is already signed in would flash it on every reload of this route.
  if (!isInitialized) return <FullScreenLoader message="Chargement de votre espace…" />;

  if (isAuthenticated) return <Navigate to={redirectTo} replace />;

  return (
    <div className="min-h-screen bg-sand-50 flex flex-col items-center justify-center p-4 sm:p-8">

      {/* Logo — the site brand mark, at the dimensions of the tile it replaces. The asset carries its
          own rounded tile and background, so it needs no wrapper styling of its own. Decorative:
          the heading below already names the product. */}
      <div className="mb-8 text-center">
        <img src="/logo.svg" alt="" className="inline-block w-12 h-12 mb-4" />
        <h1 className="font-serif text-[clamp(1.5rem,4vw,1.75rem)] font-semibold tracking-[-0.015em] text-ink">Kideo</h1>
        <p className="mt-1 text-sm text-taupe-500">Plateforme collaborative de suivi psychologique</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-4xl bg-white rounded-2xl border border-sand-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2">

          {/* ── LEFT: Validate code ───────────────────────────────────────── */}
          <div className="p-8 flex flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-petrol-600 shrink-0" />
                <h2 className="text-[15px] font-semibold text-ink">
                  J'ai un code d'invitation
                </h2>
              </div>
              <p className="text-sm text-taupe-500 leading-relaxed">
                Un code d'invitation vous a été transmis.
              </p>
            </div>
            <ValidateCodeForm
              onSubmit={code => navigate(`/enroll?code=${encodeURIComponent(code)}`)}
            />
          </div>

          {/* ── RIGHT: Login ──────────────────────────────────────────────── */}
          <div className="p-8 flex flex-col gap-6 border-t md:border-t-0 md:border-l border-sand-200">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <LogIn className="h-4 w-4 text-taupe-500 shrink-0" />
                <h2 className="text-[15px] font-semibold text-ink">
                  J'ai déjà un compte
                </h2>
              </div>
              <p className="text-sm text-taupe-500 leading-relaxed">
                Accédez à votre espace Kideo.
              </p>
            </div>
            <LoginContainer onSuccess={() => navigate(redirectTo, { replace: true })} />
          </div>

        </div>
      </div>

    </div>
  );
}
