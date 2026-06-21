import { Search, X } from 'lucide-react';
import type { ToolType, CbtTheme } from '../../../core/offline/LocalDatabase';
import { TOOL_TYPE_OPTIONS, CBT_THEME_OPTIONS } from '../utils/toolLabels';

export interface ToolFiltersProps {
  search: string;
  type: ToolType | null;
  theme: CbtTheme | null;
  onSearchChange: (value: string) => void;
  onTypeChange: (value: ToolType | null) => void;
  onThemeChange: (value: CbtTheme | null) => void;
  onReset: () => void;
}

const selectClass =
  'rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

// A pure presentational filter panel: emits criteria changes upward, owns no query state itself.
export function ToolFilters({
  search, type, theme, onSearchChange, onTypeChange, onThemeChange, onReset,
}: ToolFiltersProps) {
  const hasActiveFilter = search.trim() !== '' || type !== null || theme !== null;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative flex-1 min-w-[12rem]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Chercher par titre ou description ..."
          className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <select
        value={type ?? ''}
        onChange={e => onTypeChange(e.target.value === '' ? null : (Number(e.target.value) as ToolType))}
        className={selectClass}
      >
        <option value="">Tous les types</option>
        {TOOL_TYPE_OPTIONS.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>

      <select
        value={theme ?? ''}
        onChange={e => onThemeChange(e.target.value === '' ? null : (Number(e.target.value) as CbtTheme))}
        className={selectClass}
      >
        <option value="">Tous les thèmes</option>
        {CBT_THEME_OPTIONS.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>

      {hasActiveFilter && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-4 w-4" />
          Réinitialiser
        </button>
      )}
    </div>
  );
}
