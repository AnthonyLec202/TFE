import { Search } from 'lucide-react';

export type SessionTimeframe = 'week' | 'month' | 'all';

export interface SessionFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  timeframe: SessionTimeframe;
  onTimeframeChange: (value: SessionTimeframe) => void;
}

export function SessionFilters({
  searchTerm, onSearchChange, timeframe, onTimeframeChange,
}: SessionFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-taupe-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Chercher par titre ou nom du patient ..."
          className="w-full rounded-lg border border-sand-300 bg-white pl-9 pr-3.5 py-2.5 text-sm text-ink placeholder:text-taupe-400 focus:outline-none focus:ring-2 focus:ring-petrol-600 focus:border-transparent"
        />
      </div>

      <select
        value={timeframe}
        onChange={e => onTimeframeChange(e.target.value as SessionTimeframe)}
        className="rounded-lg border border-sand-300 bg-white px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-petrol-600 focus:border-transparent"
      >
        <option value="week">Cette semaine</option>
        <option value="month">Ce mois</option>
        <option value="all">Toutes les séances</option>
      </select>
    </div>
  );
}
