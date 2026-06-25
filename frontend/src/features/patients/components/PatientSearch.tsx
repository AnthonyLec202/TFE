import { Search } from 'lucide-react';

export interface PatientSearchProps {
  value: string;
  onChange: (value: string) => void;
  // Contextual placeholder supplied by the container (role-based terminology). Falls back to the
  // psychologist wording when omitted.
  placeholder?: string;
}

// Presentational search field for the patients dashboard. Mirrors the sessions dashboard filter
// (icon-prefixed input) but follows the "Clinique sereine" design tokens (sand/petrol/taupe).
export function PatientSearch({ value, onChange, placeholder = 'Rechercher un patient par nom…' }: PatientSearchProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-taupe-400" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-sand-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-ink placeholder:text-taupe-400 transition-colors focus:outline-none focus:ring-2 focus:ring-petrol-600 focus:border-transparent"
      />
    </div>
  );
}
