import { useId } from 'react';
import { IMaskInput, IMask } from 'react-imask';

export interface MaskedTimeInputProps {
  label?: string;
  /**
   * Current time as a `HH:mm` string — the same contract as the native
   * `<input type="time">` it replaces, so it is plug-and-play with the existing
   * `session.time` field persisted to Dexie / the .NET API.
   */
  value: string;
  /** Emits the time back as a zero-padded `HH:mm` string (or `''` when cleared). */
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  error?: string;
}

function pad2(value: string): string {
  return value.padStart(2, '0');
}

export function MaskedTimeInput({
  label, value, onChange, placeholder = 'HH:mm',
  required, disabled, id, error,
}: MaskedTimeInputProps) {
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
        // Pattern mask: `HH`/`mm` are named blocks; `:` is a fixed literal auto-injected on type.
        mask="HH:mm"
        blocks={{
          HH: { mask: IMask.MaskedRange, from: 0, to: 23, maxLength: 2 },
          mm: { mask: IMask.MaskedRange, from: 0, to: 59, maxLength: 2 },
        }}
        lazy
        unmask={false}
        id={fieldId}
        value={value}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        inputMode="numeric"
        // Fires on every accepted change: clear the bound state as soon as the field empties.
        onAccept={(accepted: string) => {
          if (accepted.replace(/\D/g, '').length === 0) onChange('');
        }}
        // Fires once both blocks are filled and valid: emit a normalised, zero-padded `HH:mm` string.
        onComplete={(completed: string) => {
          const [hours, minutes] = completed.split(':');
          onChange(`${pad2(hours)}:${pad2(minutes)}`);
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
