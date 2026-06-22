import { useEffect, useRef, useState } from 'react';
import { LogOut, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth';

const ROLE_LABELS: Record<string, string> = {
  Admin: 'Administrateur',
  Other: 'Collaborateur',
};

const ROLE_BADGE_CLASSES: Record<string, string> = {
  Admin: 'bg-petrol-50 text-petrol-600',
  Other: 'bg-sand-100 text-taupe-500',
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
        className="flex items-center justify-center w-[38px] h-[38px] rounded-full bg-petrol-600 text-white text-[13px] font-semibold hover:bg-petrol-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol-600 focus-visible:ring-offset-2"
        aria-label="Menu utilisateur"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        {initialsFromEmail(user.email)}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[236px] z-50 rounded-xl border border-sand-200 bg-white shadow-[0_8px_28px_rgba(45,40,33,0.14)] overflow-hidden">
          <div className="px-4 py-3.5 border-b border-sand-100 flex flex-col gap-2">
            <span className="text-[13.5px] font-semibold text-ink truncate">{user.email}</span>
            <span className={`self-start inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-semibold ${ROLE_BADGE_CLASSES[globalRole]}`}>
              {ROLE_LABELS[globalRole]}
            </span>
          </div>
          <nav className="p-1.5">
            <button
              type="button"
              onClick={goToProfile}
              className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13.5px] text-ink-700 hover:bg-sand-50 transition-colors"
            >
              <UserRound className="h-4 w-4 text-taupe-400" />
              Profil
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13.5px] text-[#B5453C] hover:bg-[#F6E9E6] transition-colors"
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
