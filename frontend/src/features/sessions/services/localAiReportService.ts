/**
 * Feature-local access to the clinician's own Ollama runtime, for generating a clinical report
 * without the network. Owns the worker lifecycle; the prompt and the empty-note guard live in
 * `utils/aiReportPrompt.ts` alongside their server-side mirror.
 */
import { OLLAMA_BASE, OLLAMA_MODEL, OllamaError, describeUnreachable } from '../../../services/ollamaClient';
import { AI_REPORT_SYSTEM_PROMPT, EMPTY_NOTES_MESSAGE, hasExploitableContent } from '../utils/aiReportPrompt';
import type { OllamaStreamRequest, OllamaStreamResponse } from './ollamaStreamWorker';

/** Matches AiOptions.Temperature server-side: low, so the model stays faithful to the notes. */
const TEMPERATURE = 0.15;

export interface LocalGenerationHandle {
  /** Resolves with the full report, or rejects with an {@link OllamaError}. */
  readonly result: Promise<string>;
  /** Tears the worker down. Safe to call after completion. */
  cancel(): void;
}

/**
 * Starts a generation on the local model.
 *
 * Returns a handle rather than a bare promise so the caller can cancel: a generation runs for tens
 * of seconds, and an orphaned one left running after the clinician navigates away would keep burning
 * CPU and pushing messages at a component that no longer exists.
 *
 * `onProgress` receives the FULL text produced so far, not a delta — an absolute value leaves no
 * ambiguity about ordering or about resetting the display. It fires at the worker's coalesced rate
 * (~10 Hz), never per token; see the worker header for why that distinction matters.
 */
export function generateReportLocally(
  notes: string,
  onProgress: (textSoFar: string) => void,
): LocalGenerationHandle {
  // Same defence-in-depth short-circuit as the server: a 7B model will happily invent a boilerplate
  // report from an empty note despite the prompt instruction. Never spend a generation on one.
  if (!hasExploitableContent(notes)) {
    return { result: Promise.resolve(EMPTY_NOTES_MESSAGE), cancel: () => {} };
  }

  const worker = new Worker(new URL('./ollamaStreamWorker.ts', import.meta.url), { type: 'module' });
  let settled = false;

  const request: OllamaStreamRequest = {
    baseUrl: OLLAMA_BASE,
    model: OLLAMA_MODEL,
    systemPrompt: AI_REPORT_SYSTEM_PROMPT,
    notes,
    temperature: TEMPERATURE,
  };

  // The worker emits deltas; accumulation lives here so the caller always sees an absolute value.
  let textSoFar = '';

  const result = new Promise<string>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<OllamaStreamResponse>) => {
      const message = event.data;

      if (message.type === 'delta') {
        textSoFar += message.text;
        onProgress(textSoFar);
        return;
      }

      settled = true;
      worker.terminate();

      if (message.type === 'done') {
        resolve(message.text);
        return;
      }

      reject(toOllamaError(message));
    };

    // Fires when the worker itself fails to boot or throws outside the message handler — distinct
    // from a generation error, and it would otherwise leave the promise pending forever.
    worker.onerror = event => {
      settled = true;
      worker.terminate();
      reject(new OllamaError('protocol', event.message || 'The local generation worker crashed'));
    };

    // Posted only once both handlers are attached, so a synchronous failure cannot be missed.
    worker.postMessage(request);
  });

  return {
    result,
    cancel: () => {
      if (settled) return;
      settled = true;
      worker.terminate();
    },
  };
}

function toOllamaError(message: Extract<OllamaStreamResponse, { type: 'error' }>): OllamaError {
  if (message.kind === 'unreachable') {
    return new OllamaError('unreachable', message.message, describeUnreachable());
  }

  if (message.kind === 'http') {
    const hint = message.status === 404
      ? `Le modèle « ${OLLAMA_MODEL} » n'est pas installé. Exécutez : ollama pull ${OLLAMA_MODEL}`
      : `Le moteur local (${OLLAMA_BASE}) a répondu ${message.status}.`;
    return new OllamaError('http', message.message, hint);
  }

  return new OllamaError('protocol', message.message, 'La réponse du moteur local était incomplète.');
}
