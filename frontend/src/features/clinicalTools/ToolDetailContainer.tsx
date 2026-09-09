import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useGlobalNetworkState } from '../../core/offline/hooks/useGlobalNetworkState';
import { getToolById } from './services/localTherapeuticToolService';
import { updateTool } from './services/therapeuticToolCommandService';
import { ToolDetailEditor, type ToolSaveState } from './components/ToolDetailEditor';

// Same debounce window as the session-note editor — when the clinician pauses typing, the edit is
// persisted locally and the PUT is pushed.
const AUTOSAVE_DELAY_MS = 1000;

export interface ToolDetailContainerProps {
  toolId: string;
  onBack: () => void;
  /** Label for the back-navigation control; varies by where the user came from (catalog vs. session). */
  backLabel: string;
}

// Detail/edit container for a single therapeutic tool. Reads the tool from the local Dexie mirror and
// auto-saves the clinical content (description + grading strategies) on a debounce, exactly like the
// session-note editor — no manual Save button.
export function ToolDetailContainer({ toolId, onBack, backLabel }: ToolDetailContainerProps) {
  // null = resolved-but-missing, undefined = still loading. The ?? null lets us tell them apart
  // (useLiveQuery returns undefined for both the in-flight and the not-found cases otherwise).
  const tool = useLiveQuery(async () => (await getToolById(toolId)) ?? null, [toolId]);

  // The tool catalog has no offline-first edit queue, so an edit made offline could not be pushed and
  // would be lost on the next server hydration. We therefore put the editor in read-only fallback
  // mode whenever the backend is unreachable (inputs disabled below) and never attempt a doomed PUT.
  // Read from the hoisted global state — persisted across navigation and kept fresh by the background
  // poll, so this page neither re-seeds to "online" nor pings on its own (no flash on remount).
  const isOnline = useGlobalNetworkState();

  const [description, setDescription] = useState('');
  const [downGradingStrategy, setDownGradingStrategy] = useState('');
  const [upGradingStrategy, setUpGradingStrategy] = useState('');
  const [saveState, setSaveState] = useState<ToolSaveState>('idle');

  // Which tool currently populates the fields, and whether the user has edited them since it loaded.
  // `hasEdited` gates the debounce effect so simply populating the fields never fires a redundant
  // PUT. Both live in one state rather than a ref because the re-hydration below runs during render,
  // where a ref may not be written.
  const [hydration, setHydration] = useState<{ toolId: string | null; hasEdited: boolean }>({
    toolId: null,
    hasEdited: false,
  });

  // (Re)hydrate the editable fields whenever a *different* tool is loaded — keyed on id only, so our
  // own auto-save (which rewrites this very Dexie row) does not re-run this and clobber live edits.
  if (tool && hydration.toolId !== tool.id) {
    setHydration({ toolId: tool.id, hasEdited: false });
    setDescription(tool.description);
    setDownGradingStrategy(tool.downGradingStrategy);
    setUpGradingStrategy(tool.upGradingStrategy);
    setSaveState('idle');
  }

  // Debounced auto-save: every keystroke re-arms a 1s timer; when typing pauses, persist locally
  // (optimistic) and push the PUT. Mirrors the session-note editor's effect.
  useEffect(() => {
    // Skip while offline: inputs are disabled in that mode, and a PUT would only fail. If the network
    // drops mid-debounce, the isOnline change re-runs this effect and the cleanup clears the timer.
    if (!tool || !hydration.hasEdited || !isOnline) return;
    const timer = setTimeout(async () => {
      try {
        await updateTool(tool.id, {
          title: tool.title,
          type: tool.type,
          theme: tool.theme,
          description,
          downGradingStrategy,
          upGradingStrategy,
        });
        setSaveState('saved');
      } catch (err) {
        console.error('[ToolDetail] Auto-save failed.', err);
        setSaveState('error');
      }
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description, downGradingStrategy, upGradingStrategy, isOnline]);

  // Wrap each setter so editing flips the dirty flag that arms the auto-save.
  // The keystroke both arms the auto-save and announces it. Announcing it here rather than from the
  // debounce effect keeps the state change in the event that caused it.
  const edit = (setter: (value: string) => void) => (value: string) => {
    setHydration(previous => (previous.hasEdited ? previous : { ...previous, hasEdited: true }));
    if (isOnline) setSaveState('saving');
    setter(value);
  };

  if (tool === undefined) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-taupe-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Chargement de l'outil ...</span>
      </div>
    );
  }

  if (tool === null) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-sm text-taupe-500">Cet outil est introuvable.</p>
        <Button variant="secondary" size="sm" onClick={onBack}>{backLabel}</Button>
      </div>
    );
  }

  return (
    <ToolDetailEditor
      title={tool.title}
      type={tool.type}
      theme={tool.theme}
      description={description}
      downGradingStrategy={downGradingStrategy}
      upGradingStrategy={upGradingStrategy}
      saveState={saveState}
      isOnline={isOnline}
      onBack={onBack}
      backLabel={backLabel}
      onDescriptionChange={edit(setDescription)}
      onDownGradingStrategyChange={edit(setDownGradingStrategy)}
      onUpGradingStrategyChange={edit(setUpGradingStrategy)}
    />
  );
}
