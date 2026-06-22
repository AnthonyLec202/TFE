import { useEffect, useId, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, parse, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';

export interface DatePickerProps {
  /** Field label rendered above the trigger (matches the `Input` primitive). */
  label?: string;
  /**
   * Selected date as an ISO `yyyy-MM-dd` string — the exact contract of the
   * native `<input type="date">` it replaces, so it is plug-and-play with the
   * existing string-based form state and Dexie/API persistence.
   */
  value: string;
  /** Emits the selected date back as an ISO `yyyy-MM-dd` string (or `''` when cleared). */
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  error?: string;
  /** `dropdown` exposes month/year selects — preferred for far-back dates (e.g. birth dates). */
  captionLayout?: 'label' | 'dropdown';
  /** Lower bound year, used to bound the year dropdown. */
  fromYear?: number;
  /** Upper bound year, used to bound the year dropdown. */
  toYear?: number;
}

const ISO_FORMAT = 'yyyy-MM-dd';

/** Parse an ISO `yyyy-MM-dd` string into a local `Date`, or `undefined` when empty/invalid. */
function parseIsoDate(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parse(value, ISO_FORMAT, new Date());
  return isValid(parsed) ? parsed : undefined;
}

/**
 * Tailwind class map applied to react-day-picker's internal elements so the
 * calendar renders entirely with the "Clinique sereine" design tokens — no
 * default stylesheet is imported. Selection / today / disabled states live on
 * the day `<td>`, so they are projected onto the inner `<button>` via the
 * `[&>button]` child selector.
 */
const calendarClassNames = {
  months: 'relative',
  month: 'flex flex-col gap-2',
  month_caption: 'flex h-9 items-center justify-center',
  caption_label: 'inline-flex items-center gap-1 text-sm font-semibold text-ink',
  nav: 'absolute inset-x-0 top-0 flex h-9 items-center justify-between',
  button_previous:
    'inline-flex h-7 w-7 items-center justify-center rounded-lg text-taupe-500 transition-colors hover:bg-sand-100 hover:text-ink aria-disabled:opacity-30 aria-disabled:pointer-events-none',
  button_next:
    'inline-flex h-7 w-7 items-center justify-center rounded-lg text-taupe-500 transition-colors hover:bg-sand-100 hover:text-ink aria-disabled:opacity-30 aria-disabled:pointer-events-none',
  chevron: 'h-4 w-4 fill-current',
  dropdowns: 'flex items-center justify-center gap-1.5',
  dropdown_root:
    'relative inline-flex items-center rounded-lg border border-sand-300 bg-white px-2.5 py-1 text-sm font-medium text-ink transition-colors hover:bg-sand-50',
  dropdown: 'absolute inset-0 z-10 w-full cursor-pointer opacity-0',
  month_grid: 'w-full border-collapse',
  weekdays: '',
  weekday: 'h-9 w-9 text-[11px] font-medium uppercase text-taupe-400',
  week: '',
  day: 'h-9 w-9 p-0 text-center',
  day_button:
    'inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm text-ink transition-colors hover:bg-sand-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol-600',
  selected:
    '[&>button]:!bg-petrol-600 [&>button]:!text-white [&>button]:hover:!bg-petrol-700 [&>button]:font-medium',
  today: '[&>button]:font-semibold [&>button]:text-petrol-700',
  outside: '[&>button]:text-taupe-400',
  disabled: '[&>button]:opacity-30 [&>button]:pointer-events-none',
  hidden: 'invisible',
} as const;

export function DatePicker({
  label, value, onChange, placeholder = 'Sélectionner une date', required, disabled,
  id, error, captionLayout = 'label', fromYear, toYear,
}: DatePickerProps) {
  const reactId = useId();
  const fieldId = id ?? reactId;
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDate = parseIsoDate(value);

  // Close on outside click or Escape, mirroring a Popover primitive.
  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  function handleSelect(day: Date | undefined) {
    onChange(day ? format(day, ISO_FORMAT) : '');
    if (day) setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      {label && (
        <label htmlFor={fieldId} className="text-sm font-medium text-taupe-600">
          {label}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          id={fieldId}
          disabled={disabled}
          onClick={() => setOpen(prev => !prev)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={[
            'flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3.5 py-2.5 text-left',
            'text-sm transition-colors focus:outline-none focus:ring-2 focus:border-transparent',
            'disabled:cursor-not-allowed disabled:opacity-50',
            selectedDate ? 'text-ink' : 'text-taupe-400',
            error ? 'border-red-400 focus:ring-red-500' : 'border-sand-300 focus:ring-petrol-600',
          ].join(' ')}
        >
          <span className="truncate">
            {selectedDate ? format(selectedDate, 'd MMMM yyyy', { locale: fr }) : placeholder}
          </span>
          <CalendarIcon className="h-4 w-4 shrink-0 text-taupe-500" strokeWidth={1.85} />
        </button>

        {/* Preserves native form-level `required` validation now that the field is a button. */}
        {required && (
          <input
            tabIndex={-1}
            aria-hidden="true"
            required
            value={value}
            onChange={() => {}}
            className="pointer-events-none absolute bottom-0 left-3 h-0 w-0 opacity-0"
          />
        )}

        {open && (
          <div
            role="dialog"
            className="absolute left-0 top-full z-50 mt-2 rounded-2xl border border-sand-200 bg-white p-3 shadow-[0_8px_28px_rgba(45,40,33,0.14)]"
          >
            <DayPicker
              mode="single"
              locale={fr}
              selected={selectedDate}
              onSelect={handleSelect}
              defaultMonth={selectedDate}
              captionLayout={captionLayout}
              startMonth={fromYear ? new Date(fromYear, 0, 1) : undefined}
              endMonth={toYear ? new Date(toYear, 11, 31) : undefined}
              showOutsideDays
              classNames={calendarClassNames}
            />
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
