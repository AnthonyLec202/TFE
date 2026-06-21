import { type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ToolType, CbtTheme } from '../../../core/offline/LocalDatabase';
import { TOOL_TYPE_OPTIONS, CBT_THEME_OPTIONS } from '../utils/toolLabels';

export interface ToolCreationFormProps {
  title: string;
  description: string;
  type: ToolType;
  theme: CbtTheme;
  downGradingStrategy: string;
  upGradingStrategy: string;
  submitting: boolean;
  error?: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTypeChange: (value: ToolType) => void;
  onThemeChange: (value: CbtTheme) => void;
  onDownGradingStrategyChange: (value: string) => void;
  onUpGradingStrategyChange: (value: string) => void;
  onSubmit: () => void;
}

const fieldClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const labelClass = 'text-xs font-medium text-slate-500 uppercase tracking-wide';

// Controlled presentational form embedded in the "Mes Outils" left sidebar (admin only). The
// container owns the field state, mirroring CreatePatientForm / CreateSessionForm.
export function ToolCreationForm({
  title, description, type, theme, downGradingStrategy, upGradingStrategy, submitting, error,
  onTitleChange, onDescriptionChange, onTypeChange, onThemeChange,
  onDownGradingStrategyChange, onUpGradingStrategyChange, onSubmit,
}: ToolCreationFormProps) {
  const isValid =
    title.trim() !== '' &&
    description.trim() !== '' &&
    downGradingStrategy.trim() !== '' &&
    upGradingStrategy.trim() !== '';

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isValid) onSubmit();
  }

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-4">Nouvel outil</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Titre</label>
          <input
            type="text"
            required
            value={title}
            onChange={e => onTitleChange(e.target.value)}
            placeholder="ex. Colonne de Beck"
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>Description</label>
          <textarea
            required
            rows={3}
            value={description}
            onChange={e => onDescriptionChange(e.target.value)}
            placeholder="Objectif clinique et déroulé de l'outil ..."
            className={`${fieldClass} resize-y`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>Type</label>
          <select
            value={type}
            onChange={e => onTypeChange(Number(e.target.value) as ToolType)}
            className={fieldClass}
          >
            {TOOL_TYPE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>Thème</label>
          <select
            value={theme}
            onChange={e => onThemeChange(Number(e.target.value) as CbtTheme)}
            className={fieldClass}
          >
            {CBT_THEME_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>Stratégie de simplification</label>
          <textarea
            required
            rows={2}
            value={downGradingStrategy}
            onChange={e => onDownGradingStrategyChange(e.target.value)}
            placeholder="Comment alléger l'outil si le patient est en difficulté ..."
            className={`${fieldClass} resize-y`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>Stratégie de progression</label>
          <textarea
            required
            rows={2}
            value={upGradingStrategy}
            onChange={e => onUpGradingStrategyChange(e.target.value)}
            placeholder="Comment renforcer le défi une fois le palier maîtrisé ..."
            className={`${fieldClass} resize-y`}
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end pt-1">
          <Button type="submit" size="sm" loading={submitting} disabled={!isValid}>
            Créer l'outil
          </Button>
        </div>
      </form>
    </Card>
  );
}
