import { NavLink } from 'react-router-dom';
import { useAuth } from '../../features/auth';
import { NotificationBellContainer } from '../../features/notifications';
import { UserMenu } from './UserMenu';

const activeStateClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? 'border-petrol-600 text-petrol-600 font-semibold'
    : 'border-transparent text-taupe-500 font-medium hover:text-ink';

// Inline (desktop) variant: full navbar-height tab with the bottom underline.
const desktopLinkClass = (state: { isActive: boolean }) =>
  `inline-flex items-center h-[60px] px-3 text-sm border-b-2 transition-colors ${activeStateClass(state)}`;

// Compact variant for the dedicated mobile row beneath the top bar.
const mobileLinkClass = (state: { isActive: boolean }) =>
  `inline-flex items-center whitespace-nowrap h-11 px-3 text-sm border-b-2 transition-colors ${activeStateClass(state)}`;

export function Navbar() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('Admin') ?? false;

  const links = [
    { to: '/', end: true, label: 'Mes patients', visible: true },
    { to: '/sessions', end: false, label: 'Mes séances', visible: isAdmin },
    { to: '/clinical-tools', end: false, label: 'Mes outils', visible: isAdmin },
  ].filter(link => link.visible);

  return (
    <header className="bg-white border-b border-sand-200 shrink-0">
      <div className="h-[60px] px-4 sm:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-7 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-[30px] h-[30px] shrink-0 rounded-lg bg-petrol-600 text-white flex items-center justify-center font-serif font-bold text-[15px]">
              N
            </div>
            {/* Brand word is hidden on the smallest screens to free horizontal space. */}
            <span className="hidden sm:inline font-serif font-semibold text-[17px] tracking-tight text-ink truncate">
              NeuroPlatform
            </span>
          </div>

          {/* Desktop / tablet inline navigation. */}
          {user && (
            <nav className="hidden md:flex items-center gap-1 h-[60px]">
              {links.map(link => (
                <NavLink key={link.to} to={link.to} end={link.end} className={desktopLinkClass}>
                  {link.label}
                </NavLink>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
          {user && <NotificationBellContainer />}
          {user && <UserMenu />}
        </div>
      </div>

      {/* Mobile navigation row: horizontally scrollable, keeps every tab reachable below the top bar. */}
      {user && (
        <nav className="md:hidden flex items-center gap-1 px-2 overflow-x-auto border-t border-sand-100">
          {links.map(link => (
            <NavLink key={link.to} to={link.to} end={link.end} className={mobileLinkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
