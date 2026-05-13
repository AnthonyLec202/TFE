import { Brain, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';

const ROLE_LABELS: Record<string, string> = {
  Admin: 'Administrateur',
  Parent: 'Parent',
  Teacher: 'Enseignant',
  SpeechTherapist: 'Logopède',
  PsychomotorTherapist: 'Psychomotricien',
  Ergotherapist: 'Ergothérapeute',
  Doctor: 'Médecin',
  Other: 'Collaborateur',
};

const ROLE_BADGE_CLASSES: Record<string, string> = {
  Admin: 'bg-blue-100 text-blue-700',
  Parent: 'bg-emerald-100 text-emerald-700',
  Teacher: 'bg-slate-100 text-slate-600',
  SpeechTherapist: 'bg-purple-100 text-purple-700',
  PsychomotorTherapist: 'bg-orange-100 text-orange-700',
  Ergotherapist: 'bg-yellow-100 text-yellow-700',
  Doctor: 'bg-red-100 text-red-700',
  Other: 'bg-slate-100 text-slate-600',
};

export function Navbar() {
  const { user, logout } = useAuth();
  const primaryRole = user?.roles?.[0] ?? 'Other';
  const badgeClass = ROLE_BADGE_CLASSES[primaryRole] ?? ROLE_BADGE_CLASSES.Other;

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5 text-blue-600" />
        <span className="font-semibold text-slate-900 tracking-tight">NeuroPlatform</span>
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
              {ROLE_LABELS[primaryRole] ?? primaryRole}
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
