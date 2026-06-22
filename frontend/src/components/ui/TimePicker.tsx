import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Clock as ClockIcon } from 'lucide-react';

export interface TimePickerProps {
  label?: string;
  /**
   * Selected time as a `HH:mm` string — the exact contract of the native
   * `<input type="time">` it replaces, so it is plug-and-play with the existing
   * `session.time` field persisted to Dexie / the .NET API.
   */
  value: string;
  /** Emits the selected time back as a zero-padded `HH:mm` string (or `''` when cleared). */
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  error?: string;
  /** Minute granularity offered in the column (e.g. 15 → 00/15/30/45). Defaults to 15. */
  minuteStep?: number;
}

const TIME_PATTERN = /^([01]?\d|2[0-3]):[0-5]\d$/;

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

/** Split a `HH:mm` string into numeric parts, or `null` when empty/invalid. */
function parseTime(value: string): { hour: number; minute: number } | null {
  if (!TIME_PATTERN.test(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  return { hour, minute };
}

export function TimePicker({
  label, value, onChange, placeholder = 'Sélectionner une heure',
  required, disabled, id, error, minuteStep = 15,
}: TimePickerProps) {
  const reactId = useId();
  const fieldId = id ?? reactId;
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);

  // Local buffer for free-form manual entry; mirrors `value` but tolerates intermediate keystrokes.
  const [manualValue, setManualValue] = useState(value);
  useEffect(() => setManualValue(value), [value]);

  const parsed = parseTime(value);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, h) => h), []);
  const minutes = useMemo(
    () => Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep),
    [minuteStep],
  );

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

  // Scroll the currently-selected hour/minute into view each time the popover opens.
  useEffect(() => {
    if (!open) return;
    hoursRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'center' });
    minutesRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'center' });
  }, [open]);

  function commit(hour: number, minute: number) {
    onChange(`${pad2(hour)}:${pad2(minute)}`);
  }

  function selectHour(hour: number) {
    commit(hour, parsed?.minute ?? 0);
  }

  function selectMinute(minute: number) {
    commit(parsed?.hour ?? 0, minute);
  }

  function handleManualChange(next: string) {
    setManualValue(next);
    if (TIME_PATTERN.test(next)) {
      const { hour, minute } = parseTime(next)!;
      commit(hour, minute);
    }
  }

  const columnButton =
    'w-full rounded-md px-2 py-1.5 text-sm text-center transition-colors data-[selected=true]:bg-petrol-600 data-[selected=true]:text-white data-[selected=true]:font-medium hover:bg-sand-100 data-[selected=true]:hover:bg-petrol-700';

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
            parsed ? 'text-ink' : 'text-taupe-400',
            error ? 'border-red-400 focus:ring-red-500' : 'border-sand-300 focus:ring-petrol-600',
          ].join(' ')}
        >
          <span className="truncate">{parsed ? value : placeholder}</span>
          <ClockIcon className="h-4 w-4 shrink-0 text-taupe-500" strokeWidth={1.85} />
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
            className="absolute left-0 top-full z-50 mt-2 w-[220px] rounded-2xl border border-sand-200 bg-white p-3 shadow-[0_8px_28px_rgba(45,40,33,0.14)]"
          >
            {/* Manual entry — supports any minute outside the stepped column. */}
            <input
              type="text"
              inputMode="numeric"
              placeholder="HH:mm"
              value={manualValue}
              onChange={e => handleManualChange(e.target.value)}
              className="mb-3 w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-ink placeholder:text-taupe-400 focus:outline-none focus:ring-2 focus:ring-petrol-600 focus:border-transparent"
            />

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="px-2 text-[11px] font-medium uppercase tracking-wide text-taupe-400">Heures</span>
                <div ref={hoursRef} className="flex max-h-44 flex-col gap-0.5 overflow-y-auto pr-1">
                  {hours.map(hour => (
                    <button
                      key={hour}
                      type="button"
                      data-selected={parsed?.hour === hour}
                      onClick={() => selectHour(hour)}
                      className={columnButton}
                    >
                      {pad2(hour)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="px-2 text-[11px] font-medium uppercase tracking-wide text-taupe-400">Minutes</span>
                <div ref={minutesRef} className="flex max-h-44 flex-col gap-0.5 overflow-y-auto pr-1">
                  {minutes.map(minute => (
                    <button
                      key={minute}
                      type="button"
                      data-selected={parsed?.minute === minute}
                      onClick={() => selectMinute(minute)}
                      className={columnButton}
                    >
                      {pad2(minute)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
