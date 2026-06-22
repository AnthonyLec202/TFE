import { type SubmitEvent } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { MaskedDateInput } from '../../../components/ui/MaskedDateInput';

export interface CreatePatientFormProps {
  firstName: string;
  lastName: string;
  birthDate: string;
  submitting: boolean;
  error?: string;
  info?: string;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onBirthDateChange: (value: string) => void;
  onSubmit: () => void;
}

export function CreatePatientForm({
  firstName, lastName, birthDate, submitting, error, info,
  onFirstNameChange, onLastNameChange, onBirthDateChange, onSubmit,
}: CreatePatientFormProps) {
  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <Card className="p-[22px]">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-[30px] h-[30px] rounded-lg bg-petrol-50 text-petrol-600 flex items-center justify-center shrink-0">
          <UserPlus className="h-4 w-4" strokeWidth={1.85} />
        </span>
        <h2 className="text-[15px] font-semibold text-ink">Nouveau patient</h2>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Prénom"
            type="text"
            placeholder="Léa"
            value={firstName}
            onChange={e => onFirstNameChange(e.target.value)}
            required
          />
          <Input
            label="Nom"
            type="text"
            placeholder="Martin"
            value={lastName}
            onChange={e => onLastNameChange(e.target.value)}
            required
          />
        </div>

        <MaskedDateInput
          label="Date de naissance"
          value={birthDate}
          onChange={onBirthDateChange}
          placeholder="jj / mm / aaaa"
          required
        />

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {info && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            {info}
          </p>
        )}

        <div className="flex justify-end pt-1">
          <Button
            type="submit"
            size="sm"
            loading={submitting}
            disabled={!firstName.trim() || !lastName.trim() || !birthDate}
          >
            Créer le patient
          </Button>
        </div>
      </form>
    </Card>
  );
}
