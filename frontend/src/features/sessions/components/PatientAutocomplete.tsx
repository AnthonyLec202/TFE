import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { LocalPatientSync } from '../../../core/offline/LocalDatabase';
import { searchLocalPatients } from '../../patients';

interface PatientAutocompleteProps {
  selectedPatients: LocalPatientSync[];
  onChange: (patients: LocalPatientSync[]) => void;
}

export function PatientAutocomplete({ selectedPatients, onChange }: PatientAutocompleteProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<LocalPatientSync[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!inputValue.trim()) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }
      const results = await searchLocalPatients(inputValue);
      // Exclude already-selected patients
      const selectedIds = new Set(selectedPatients.map(p => p.id));
      setSuggestions(results.filter(p => !selectedIds.has(p.id)));
      setIsOpen(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue, selectedPatients]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selectPatient(patient: LocalPatientSync) {
    onChange([...selectedPatients, patient]);
    setInputValue('');
    setSuggestions([]);
    setIsOpen(false);
  }

  function removePatient(id: string) {
    onChange(selectedPatients.filter(p => p.id !== id));
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Patients</label>

      <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent min-h-[42px]">
        {selectedPatients.map(p => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs px-2.5 py-1"
          >
            {p.firstName} {p.lastName}
            <button
              type="button"
              onClick={() => removePatient(p.id)}
              className="text-blue-400 hover:text-blue-700 transition-colors"
              aria-label={`Remove ${p.firstName} ${p.lastName}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
          placeholder={selectedPatients.length === 0 ? 'Chercher un patient ...' : ''}
          className="flex-1 min-w-[120px] text-sm text-slate-900 placeholder:text-slate-400 bg-transparent outline-none py-0.5"
        />
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute top-full mt-1 left-0 right-0 z-10 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-md">
          {suggestions.map(patient => (
            <li key={patient.id}>
              <button
                type="button"
                onClick={() => selectPatient(patient)}
                className="w-full px-3.5 py-2.5 text-left text-sm text-slate-800 hover:bg-blue-50 transition-colors"
              >
                {patient.firstName} {patient.lastName}
              </button>
            </li>
          ))}
        </ul>
      )}

      {isOpen && suggestions.length === 0 && inputValue.trim() && (
        <div className="absolute top-full mt-1 left-0 right-0 z-10 rounded-lg border border-slate-200 bg-white shadow-md px-3.5 py-2.5">
          <p className="text-sm text-slate-400">Aucun patient trouvé</p>
        </div>
      )}
    </div>
  );
}
