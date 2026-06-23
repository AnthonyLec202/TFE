import { type SubmitEvent } from 'react';
import { Calendar } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { DatePicker } from '../../../components/ui/DatePicker';
import { MaskedTimeInput } from '../../../components/ui/MaskedTimeInput';
import type { LocalPatientSync } from '../../../core/offline/LocalDatabase';
import { PatientAutocomplete } from './PatientAutocomplete';

export interface CreateSessionFormProps {
  title: string;
  date: string;
  time: string;
  selectedPatients: LocalPatientSync[];
  submitting: boolean;
  onTitleChange: (title: string) => void;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  onPatientsChange: (patients: LocalPatientSync[]) => void;
  onSubmit: () => void;
}

export function CreateSessionForm({
  title, date, time, selectedPatients, submitting,
  onTitleChange, onDateChange, onTimeChange, onPatientsChange, onSubmit,
}: CreateSessionFormProps) {
  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-[30px] h-[30px] rounded-lg bg-petrol-50 text-petrol-600 flex items-center justify-center shrink-0">
          <Calendar className="h-4 w-4" strokeWidth={1.85} />
        </span>
        <h2 className="text-[15px] font-semibold text-ink">Nouvelle séance</h2>
      </div>
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

        <div className="flex justify-end pt-1">
          <Button type="submit" size="sm" loading={submitting} disabled={!title.trim() || !date || !time}>
            Créer la séance
          </Button>
        </div>
      </form>
    </Card>
  );
}
