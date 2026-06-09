import { Brain, LogOut } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../features/auth';
import { Button } from '../ui/Button';

const ROLE_LABELS: Record<string, string> = {
  Admin: 'Administrateur',
  Other: 'Collaborateur',
};

const ROLE_BADGE_CLASSES: Record<string, string> = {
  Admin: 'bg-blue-100 text-blue-700',
  Other: 'bg-slate-100 text-slate-600',
};

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center h-14 px-1 text-sm font-medium border-b-2 transition-colors ${
    isActive
      ? 'border-blue-600 text-blue-600'
      : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
  }`;

export function Navbar() {
  const { user, logout } = useAuth();
  const isAdmin = user?.roles?.includes('Admin') ?? false;
  const globalRole = isAdmin ? 'Admin' : 'Other';
  const badgeClass = ROLE_BADGE_CLASSES[globalRole];
  const label = ROLE_LABELS[globalRole];

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-blue-600" />
          <span className="font-semibold text-slate-900 tracking-tight">NeuroPlatform</span>
        </div>

        {user && (
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navLinkClass}>
              My Patients
            </NavLink>
            {isAdmin && (
              <NavLink to="/sessions" className={navLinkClass}>
                My Sessions
              </NavLink>
            )}
          </nav>
        )}
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
              {label}
            </span>
            <span className="hidden sm:block text-sm text-slate-500">{user.email}</span>
          </>
        )}
        <Button variant="ghost" size="sm" onClick={logout}>
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Déconnexion</span>
        </Button>
      </div>
    </header>
  );
}
