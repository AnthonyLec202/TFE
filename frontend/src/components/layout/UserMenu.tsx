import { useEffect, useRef, useState } from 'react';
import { LogOut, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth';

const ROLE_LABELS: Record<string, string> = {
  Admin: 'Administrateur',
  Other: 'Collaborateur',
};

const ROLE_BADGE_CLASSES: Record<string, string> = {
  Admin: 'bg-blue-100 text-blue-700',
  Other: 'bg-slate-100 text-slate-600',
};

// Derive up-to-two-letter initials from the email local part (the JWT carries no name).
function initialsFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? '';
  const letters = localPart.replace(/[^a-zA-Z]/g, '');
  return (letters.slice(0, 2) || email.slice(0, 2)).toUpperCase();
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const globalRole = user.roles?.includes('Admin') ? 'Admin' : 'Other';

  function goToProfile() {
    setIsOpen(false);
    navigate('/profile');
  }

  function handleLogout() {
    setIsOpen(false);
    logout();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(open => !open)}
        className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        aria-label="Menu utilisateur"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        {initialsFromEmail(user.email)}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-60 z-50 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-900 truncate">{user.email}</span>
            <span className={`self-start inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE_CLASSES[globalRole]}`}>
              {ROLE_LABELS[globalRole]}
            </span>
          </div>
          <nav className="py-1">
            <button
              type="button"
              onClick={goToProfile}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <UserRound className="h-4 w-4 text-slate-400" />
              Profil
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
