import { Search, X } from 'lucide-react';

export interface ToolFiltersProps {
  search: string;
  type: string | null;
  theme: string | null;
  /** Distinct Type / Theme values present in the catalog, used to populate the filter dropdowns. */
  typeOptions: string[];
  themeOptions: string[];
  onSearchChange: (value: string) => void;
  onTypeChange: (value: string | null) => void;
  onThemeChange: (value: string | null) => void;
  onReset: () => void;
}

const selectClass =
  'rounded-lg border border-sand-300 bg-white px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-petrol-600 focus:border-transparent';

// A pure presentational filter panel: emits criteria changes upward, owns no query state itself.
export function ToolFilters({
  search, type, theme, typeOptions, themeOptions,
  onSearchChange, onTypeChange, onThemeChange, onReset,
}: ToolFiltersProps) {
  const hasActiveFilter = search.trim() !== '' || type !== null || theme !== null;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative min-w-[12rem] flex-1">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-taupe-400" />
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Chercher par titre ou description ..."
          className="w-full rounded-lg border border-sand-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-ink placeholder:text-taupe-400 focus:outline-none focus:ring-2 focus:ring-petrol-600 focus:border-transparent"
        />
      </div>

      <select
        value={type ?? ''}
        onChange={e => onTypeChange(e.target.value === '' ? null : e.target.value)}
        className={selectClass}
      >
        <option value="">Tous les types</option>
        {typeOptions.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>

      <select
        value={theme ?? ''}
        onChange={e => onThemeChange(e.target.value === '' ? null : e.target.value)}
        className={selectClass}
      >
        <option value="">Tous les thèmes</option>
        {themeOptions.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>

      {hasActiveFilter && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2.5 text-sm text-taupe-500 hover:bg-sand-100 hover:text-ink"
        >
          <X className="h-4 w-4" />
          Réinitialiser
        </button>
      )}
    </div>
  );
}
