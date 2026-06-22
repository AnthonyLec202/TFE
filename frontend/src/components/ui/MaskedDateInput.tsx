import { useId } from 'react';
import { IMaskInput, IMask } from 'react-imask';
import { format, parse, isValid } from 'date-fns';

export interface MaskedDateInputProps {
  label?: string;
  /**
   * Current date as an ISO `yyyy-MM-dd` string or a `Date` — the same contract
   * as the native `<input type="date">` it replaces, so it is plug-and-play with
   * the existing form state and Dexie/.NET persistence.
   */
  value: string | Date;
  /** Emits the date back as a clean ISO `yyyy-MM-dd` string (or `''` when cleared). */
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  error?: string;
}

const ISO_FORMAT = 'yyyy-MM-dd';
const DISPLAY_FORMAT = 'dd / MM / yyyy';
/** Year bounds enforced by the mask's `YYYY` block. */
const MIN_YEAR = 1900;
const MAX_YEAR = 2026;

/** Normalise the incoming value (ISO string or `Date`) to a `Date`, or `undefined` when empty/invalid. */
function toDate(value: string | Date): Date | undefined {
  if (value instanceof Date) return isValid(value) ? value : undefined;
  if (!value) return undefined;
  const parsed = parse(value, ISO_FORMAT, new Date());
  return isValid(parsed) ? parsed : undefined;
}

/** Render the incoming value as the masked `dd / mm / yyyy` display string. */
function toDisplay(value: string | Date): string {
  const date = toDate(value);
  return date ? format(date, DISPLAY_FORMAT) : '';
}

/** Convert a complete `dd / mm / yyyy` masked string into an ISO date, validating the calendar date. */
function displayToIso(display: string): string | null {
  const digits = display.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const candidate = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  const parsed = parse(candidate, 'dd/MM/yyyy', new Date());
  // Round-trip guard rejects impossible dates (e.g. 31/02) the parser would otherwise roll over.
  if (!isValid(parsed) || format(parsed, 'dd/MM/yyyy') !== candidate) return null;
  return format(parsed, ISO_FORMAT);
}

export function MaskedDateInput({
  label, value, onChange, placeholder = 'jj / mm / aaaa',
  required, disabled, id, error,
}: MaskedDateInputProps) {
  const reactId = useId();
  const fieldId = id ?? reactId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={fieldId} className="text-sm font-medium text-taupe-600">
          {label}
        </label>
      )}

      <IMaskInput
        // Pattern mask: `DD`/`MM`/`YYYY` are named blocks; " / " are fixed literals auto-injected on type.
        mask="DD / MM / YYYY"
        blocks={{
          DD: { mask: IMask.MaskedRange, from: 1, to: 31, maxLength: 2 },
          MM: { mask: IMask.MaskedRange, from: 1, to: 12, maxLength: 2 },
          YYYY: { mask: IMask.MaskedRange, from: MIN_YEAR, to: MAX_YEAR, maxLength: 4 },
        }}
        lazy
        unmask={false}
        id={fieldId}
        value={toDisplay(value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        inputMode="numeric"
        // Fires on every accepted change: clear the bound state as soon as the field empties.
        onAccept={(accepted: string) => {
          if (accepted.replace(/\D/g, '').length === 0) onChange('');
        }}
        // Fires once the mask is fully filled and valid: emit the clean ISO string.
        onComplete={(completed: string) => {
          const iso = displayToIso(completed);
          if (iso) onChange(iso);
        }}
        className={[
          'w-full rounded-lg border bg-white px-3.5 py-2.5',
          'text-sm text-ink placeholder:text-taupe-400',
          'transition-colors focus:outline-none focus:ring-2 focus:border-transparent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error ? 'border-red-400 focus:ring-red-500' : 'border-sand-300 focus:ring-petrol-600',
        ].join(' ')}
      />

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
