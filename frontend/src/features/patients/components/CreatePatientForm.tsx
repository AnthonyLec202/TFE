import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';

export interface CreatePatientFormProps {
  firstName: string;
  lastName: string;
  birthDate: string;
  submitting: boolean;
  error?: string;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onBirthDateChange: (value: string) => void;
  onSubmit: () => void;
}

export function CreatePatientForm({
  firstName, lastName, birthDate, submitting, error,
  onFirstNameChange, onLastNameChange, onBirthDateChange, onSubmit,
}: CreatePatientFormProps) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-4">Nouveau patient</h2>
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

        <Input
          label="Date de naissance"
          type="date"
          value={birthDate}
          onChange={e => onBirthDateChange(e.target.value)}
          required
        />

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
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
