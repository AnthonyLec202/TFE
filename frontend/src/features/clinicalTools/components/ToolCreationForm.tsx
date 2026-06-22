import { type FormEvent } from 'react';
import { Wrench } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { CreatableCombobox } from './CreatableCombobox';

export interface ToolCreationFormProps {
  title: string;
  type: string;
  theme: string;
  /** Existing Type / Theme values suggested by the comboboxes (new values are still accepted). */
  typeOptions: string[];
  themeOptions: string[];
  submitting: boolean;
  /** When false (backend unreachable), submission is blocked — creation needs a live server. */
  isOnline: boolean;
  error?: string;
  onTitleChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onThemeChange: (value: string) => void;
  onSubmit: () => void;
}

const labelClass = 'text-[12.5px] font-medium text-taupe-600';
const inputClass =
  'w-full rounded-lg border border-sand-300 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-taupe-400 transition-colors focus:outline-none focus:ring-2 focus:ring-petrol-600 focus:border-transparent';

// Stripped-down creation form embedded in the "Mes Outils" left sidebar (admin only). It captures
// only the tool's identity (Title) and its two free-form categories (Type, Theme) — the rich clinical
// content (description, grading strategies) is authored later on the auto-saving detail page. The
// container owns the field state, mirroring CreatePatientForm / CreateSessionForm.
export function ToolCreationForm({
  title, type, theme, typeOptions, themeOptions, submitting, isOnline, error,
  onTitleChange, onTypeChange, onThemeChange, onSubmit,
}: ToolCreationFormProps) {
  const isValid = title.trim() !== '' && type.trim() !== '' && theme.trim() !== '';

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isValid && isOnline) onSubmit();
  }

  return (
    <Card className="p-[22px]">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-petrol-50 text-petrol-600">
          <Wrench className="h-4 w-4" strokeWidth={1.85} />
        </span>
        <h2 className="text-[15px] font-semibold text-ink">Nouvel outil</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Titre</label>
          <input
            type="text"
            required
            value={title}
            onChange={e => onTitleChange(e.target.value)}
            placeholder="ex. Colonne de Beck"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Type</label>
          <CreatableCombobox
            value={type}
            onChange={onTypeChange}
            options={typeOptions}
            placeholder="ex. Protocole d'exposition"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Thème</label>
          <CreatableCombobox
            value={theme}
            onChange={onThemeChange}
            options={themeOptions}
            placeholder="ex. Gestion de l'anxiété"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {!isOnline && (
          <p className="text-xs text-[#B5453C]">
            Hors ligne — la création est indisponible tant que le serveur est injoignable.
          </p>
        )}

        <div className="flex justify-end pt-1">
          <Button type="submit" size="sm" loading={submitting} disabled={!isValid || !isOnline}>
            Créer l'outil
          </Button>
        </div>
      </form>
    </Card>
  );
}
