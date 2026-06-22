import { useId } from 'react';

export interface CreatableComboboxProps {
  value: string;
  onChange: (value: string) => void;
  /** Existing values suggested in the dropdown. The field still accepts any freely typed string. */
  options: string[];
  placeholder?: string;
}

// A creatable select built on the native <datalist>: it suggests the existing category values while
// letting the clinician type and submit an entirely new one. Pure presentational — no state, no I/O.
export function CreatableCombobox({ value, onChange, options, placeholder }: CreatableComboboxProps) {
  const listId = useId();
  return (
    <>
      <input
        type="text"
        list={listId}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-sand-300 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-taupe-400 transition-colors focus:outline-none focus:ring-2 focus:ring-petrol-600 focus:border-transparent"
      />
      <datalist id={listId}>
        {options.map(option => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  );
}
