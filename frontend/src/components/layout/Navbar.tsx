import { Brain } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../features/auth';
import { NotificationBellContainer } from '../../features/notifications';
import { UserMenu } from './UserMenu';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center h-14 px-1 text-sm font-medium border-b-2 transition-colors ${
    isActive
      ? 'border-blue-600 text-blue-600'
      : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
  }`;

export function Navbar() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('Admin') ?? false;

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
        {user && <NotificationBellContainer />}
        {user && <UserMenu />}
      </div>
    </header>
  );
}
