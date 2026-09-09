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
const DISPLAY_FORMAT = 'dd/MM/yyyy';

/** Parse an ISO `yyyy-MM-dd` string into a local `Date`, or `undefined` when empty/invalid. */
function parseIsoDate(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parse(value, ISO_FORMAT, new Date());
  return isValid(parsed) ? parsed : undefined;
}

/** Render an ISO date as the editable `dd / mm / yyyy` display string. */
function isoToDisplay(value: string): string {
  const date = parseIsoDate(value);
  return date ? format(date, DISPLAY_FORMAT) : '';
}

/** Progressively format raw keystrokes into `dd / mm / yyyy` (digits only, grouped 2-2-4). */
function maskDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  let out = digits.slice(0, 2);
  if (digits.length > 2) out += '/' + digits.slice(2, 4);
  if (digits.length > 4) out += '/' + digits.slice(4, 8);
  return out;
}

/** Convert a complete `dd / mm / yyyy` display string into an ISO date, validating the calendar date. */
function displayToIso(display: string): string | null {
  const digits = display.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const candidate = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  const parsed = parse(candidate, 'dd/MM/yyyy', new Date());
  // Round-trip guard rejects impossible dates (e.g. 31/02) that `parse` would otherwise roll over.
  if (!isValid(parsed) || format(parsed, 'dd/MM/yyyy') !== candidate) return null;
  return format(parsed, ISO_FORMAT);
}

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
  label, value, onChange, placeholder = 'jj/mm/aaaa', required, disabled,
  id, error, captionLayout = 'label', fromYear, toYear,
}: DatePickerProps) {
  const reactId = useId();
  const fieldId = id ?? reactId;
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDate = parseIsoDate(value);

  // The text input is the source of truth while typing; it is re-synced whenever `value` changes
  // externally (e.g. a calendar pick), but stays untouched during partial/in-progress entry.
  const [text, setText] = useState(() => isoToDisplay(value));
  // Re-synced during render rather than from an effect: an effect would commit the stale text first,
  // then immediately re-render with the new one — a visible flicker on every external change.
  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue !== value) {
    setSyncedValue(value);
    setText(isoToDisplay(value));
  }

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

  function handleTextChange(raw: string) {
    const masked = maskDisplay(raw);
    setText(masked);
    if (masked.replace(/\D/g, '').length === 0) {
      onChange('');
      return;
    }
    const iso = displayToIso(masked);
    if (iso) onChange(iso);
  }

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
        <input
          type="text"
          inputMode="numeric"
          id={fieldId}
          disabled={disabled}
          required={required}
          value={text}
          placeholder={placeholder}
          onChange={e => handleTextChange(e.target.value)}
          className={[
            'w-full rounded-lg border bg-white py-2.5 pl-3 pr-9 text-sm text-ink placeholder:text-taupe-400',
            'transition-colors focus:outline-none focus:ring-2 focus:border-transparent',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error ? 'border-red-400 focus:ring-red-500' : 'border-sand-300 focus:ring-petrol-600',
          ].join(' ')}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => setOpen(prev => !prev)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Ouvrir le calendrier"
          className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-taupe-500 transition-colors hover:bg-sand-100 hover:text-ink disabled:opacity-50"
        >
          <CalendarIcon className="h-4 w-4" strokeWidth={1.85} />
        </button>

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
