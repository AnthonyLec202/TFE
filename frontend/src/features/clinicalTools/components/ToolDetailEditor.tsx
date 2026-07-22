import { ArrowDownNarrowWide, ArrowLeft, ArrowUpNarrowWide, Check, CloudOff, Loader2 } from 'lucide-react';
import { OfflinePill } from '../../../components/ui/OfflinePill';

export type ToolSaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface ToolDetailEditorProps {
  title: string;
  type: string;
  theme: string;
  description: string;
  downGradingStrategy: string;
  upGradingStrategy: string;
  saveState: ToolSaveState;
  /** When false, the editor is in read-only fallback mode: every field is disabled. */
  isOnline: boolean;
  onBack: () => void;
  /** Text shown next to the back arrow; set contextually by the page (catalog vs. originating session). */
  backLabel: string;
  onDescriptionChange: (value: string) => void;
  onDownGradingStrategyChange: (value: string) => void;
  onUpGradingStrategyChange: (value: string) => void;
}

const textareaClass =
  'w-full rounded-xl border border-sand-300 bg-white px-3.5 py-3 text-sm leading-relaxed text-ink placeholder:text-taupe-400 transition-colors focus:outline-none focus:ring-2 focus:ring-petrol-600 focus:border-transparent resize-y disabled:cursor-not-allowed disabled:bg-sand-100 disabled:opacity-60';
const labelClass = 'text-[12.5px] font-semibold uppercase tracking-wide text-taupe-600';

// Pure presentational editor for a tool's clinical content. All three fields auto-save (debounced in
// the container); there is deliberately no Save button. Title/Type/Theme are shown read-only in the
// header — they are set at creation and edited elsewhere.
export function ToolDetailEditor({
  title, type, theme, description, downGradingStrategy, upGradingStrategy, saveState, isOnline,
  onBack, backLabel, onDescriptionChange, onDownGradingStrategyChange, onUpGradingStrategyChange,
}: ToolDetailEditorProps) {
  const readOnly = !isOnline;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-taupe-500 transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </button>

        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="font-serif text-[clamp(1.5rem,4.5vw,1.875rem)] font-semibold tracking-[-0.015em] text-ink">{title}</h1>
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center rounded-full bg-petrol-50 px-2.5 py-0.5 text-xs font-medium text-petrol-600">
                {type}
              </span>
              <span className="inline-flex items-center rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-medium text-taupe-600">
                {theme}
              </span>
            </div>
          </div>
          {/* Status indicators are decoupled: the offline pill renders independently whenever the
              network is down, and the passive save indicator shows its own state alongside it. */}
          <div className="flex shrink-0 items-center gap-2">
            {readOnly && <OfflinePill />}
            <SaveIndicator state={saveState} />
          </div>
        </div>
      </div>

      {readOnly && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <CloudOff className="h-4 w-4 shrink-0 text-amber-700" />
          <p className="text-sm text-amber-700">
            Vous êtes hors ligne. L'édition est désactivée pour éviter toute perte de données ; les
            modifications ne pourraient pas être synchronisées. Reconnectez-vous pour modifier cet outil.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>Description</label>
        <textarea
          rows={5}
          value={description}
          onChange={e => onDescriptionChange(e.target.value)}
          disabled={readOnly}
          placeholder="Objectif clinique et déroulé de l'outil ..."
          className={textareaClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1.5 text-[12.5px] font-semibold uppercase tracking-wide text-[#9A6A18]">
            <ArrowDownNarrowWide className="h-4 w-4" />
            Stratégie de simplification
          </label>
          <textarea
            rows={5}
            value={downGradingStrategy}
            onChange={e => onDownGradingStrategyChange(e.target.value)}
            disabled={readOnly}
            placeholder="Comment alléger l'outil si le patient est en difficulté ..."
            className={textareaClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1.5 text-[12.5px] font-semibold uppercase tracking-wide text-[#2F7D5B]">
            <ArrowUpNarrowWide className="h-4 w-4" />
            Stratégie de progression
          </label>
          <textarea
            rows={5}
            value={upGradingStrategy}
            onChange={e => onUpGradingStrategyChange(e.target.value)}
            disabled={readOnly}
            placeholder="Comment renforcer le défi une fois le palier maîtrisé ..."
            className={textareaClass}
          />
        </div>
      </div>
    </div>
  );
}

// Mirrors the session-note editor's save affordance: a passive status pill, never a button.
function SaveIndicator({ state }: { state: ToolSaveState }) {
  const base = 'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px]';
  if (state === 'saving') {
    return (
      <span className={`${base} border border-sand-200 bg-sand-100 text-taupe-500`}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Enregistrement…
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className={`${base} border border-[#CADDD0] bg-[#E6F0EA] text-[#2F7D5B]`}>
        <Check className="h-3.5 w-3.5" />
        Enregistré
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className={`${base} border border-[#E7CEC8] bg-[#F6E9E6] text-[#B5453C]`}>
        <CloudOff className="h-3.5 w-3.5" />
        Échec de l'enregistrement
      </span>
    );
  }
  return null;
}
