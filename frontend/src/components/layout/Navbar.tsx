import { NavLink } from 'react-router-dom';
import { useAuth } from '../../features/auth';
import { NotificationBellContainer } from '../../features/notifications';
import { UserMenu } from './UserMenu';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center h-[60px] px-3 text-sm border-b-2 transition-colors ${
    isActive
      ? 'border-petrol-600 text-petrol-600 font-semibold'
      : 'border-transparent text-taupe-500 font-medium hover:text-ink'
  }`;

export function Navbar() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('Admin') ?? false;

  return (
    <header className="h-[60px] bg-white border-b border-sand-200 px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-7">
        <div className="flex items-center gap-2.5">
          <div className="w-[30px] h-[30px] rounded-lg bg-petrol-600 text-white flex items-center justify-center font-serif font-bold text-[15px]">
            N
          </div>
          <span className="font-serif font-semibold text-[17px] tracking-tight text-ink">NeuroPlatform</span>
        </div>

        {user && (
          <nav className="flex items-center gap-1 h-[60px]">
            <NavLink to="/" end className={navLinkClass}>
              Mes patients
            </NavLink>
            {isAdmin && (
              <NavLink to="/sessions" className={navLinkClass}>
                Mes séances
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to="/clinical-tools" className={navLinkClass}>
                Mes outils
              </NavLink>
            )}
          </nav>
        )}
      </div>

      <div className="flex items-center gap-3.5">
        {user && <NotificationBellContainer />}
        {user && <UserMenu />}
      </div>
    </header>
  );
}
