import { type SubmitEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { DatePicker } from '../../../components/ui/DatePicker';
import { MaskedTimeInput } from '../../../components/ui/MaskedTimeInput';
import type { LocalPatientSync } from '../../../core/offline/LocalDatabase';
import { PatientAutocomplete } from './PatientAutocomplete';

export interface SessionEditModalProps {
  title: string;
  date: string;
  time: string;
  selectedPatients: LocalPatientSync[];
  saving: boolean;
  onTitleChange: (title: string) => void;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  onPatientsChange: (patients: LocalPatientSync[]) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function SessionEditModal({
  title, date, time, selectedPatients, saving,
  onTitleChange, onDateChange, onTimeChange, onPatientsChange, onSubmit, onClose,
}: SessionEditModalProps) {
  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 px-4">
      <Card className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-[15px] font-semibold text-ink mb-4">Modifier la séance</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-taupe-500 uppercase tracking-wide">Titre</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => onTitleChange(e.target.value)}
              placeholder="ex. Bilan hebdomadaire"
              className="w-full rounded-lg border border-sand-300 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-taupe-400 focus:outline-none focus:ring-2 focus:ring-petrol-600 focus:border-transparent"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-taupe-500 uppercase tracking-wide">Date</label>
              <DatePicker
                value={date}
                onChange={onDateChange}
                placeholder="jj/mm/aaaa"
                required
              />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-taupe-500 uppercase tracking-wide">Heure</label>
              <MaskedTimeInput
                value={time}
                onChange={onTimeChange}
                placeholder="HH:mm"
                required
              />
            </div>
          </div>

          <PatientAutocomplete
            selectedPatients={selectedPatients}
            onChange={onPatientsChange}
          />

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" size="sm" loading={saving} disabled={!title.trim() || !date || !time}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
