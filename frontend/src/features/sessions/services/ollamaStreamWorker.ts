/// <reference lib="webworker" />
/**
 * Web Worker that drives a local Ollama generation end to end: the HTTP request, the NDJSON stream
 * parsing, and the accumulation — all off the main thread.
 *
 * WHY A WORKER (audit point 9)
 * The `fetch` itself was never the problem: network I/O is already off-thread. What saturates the
 * main thread is what a naive implementation does with the stream — decode a chunk, JSON.parse it,
 * setState, re-render, per token, 30 to 80 times a second, for a minute or more. That is not one
 * long task but an unbroken sequence of them, and it starves the timers SignalR relies on to send
 * its keep-alive pings. Past the server's ClientTimeoutInterval the hub drops the connection.
 *
 * So parsing happens here, and deltas are coalesced and posted at FLUSH_INTERVAL_MS rather than per
 * token: the UI still reads as live, at roughly 10 renders per second instead of several thousand.
 *
 * The worker is self-contained on purpose — every parameter arrives in the start message rather than
 * being imported. It keeps the bundle boundary trivial and makes the worker a pure function of its
 * input. Cancellation is `worker.terminate()` from the owning service, which tears the fetch down
 * with the thread; there is no abort protocol to keep in sync.
 */

import { takeCompleteLines, extractStreamedContent } from '../utils/ndjsonStream';

/** ~10 Hz: fast enough to read as continuous, slow enough to leave the main thread idle. */
const FLUSH_INTERVAL_MS = 100;

export interface OllamaStreamRequest {
  baseUrl: string;
  model: string;
  systemPrompt: string;
  notes: string;
  temperature: number;
}

export type OllamaStreamResponse =
  /** Text produced since the previous delta. */
  | { type: 'delta'; text: string }
  /** Terminal success, carrying the full report. */
  | { type: 'done'; text: string }
  /** Terminal failure. `kind` mirrors OllamaFailureKind in services/ollamaClient.ts. */
  | { type: 'error'; kind: 'unreachable' | 'http' | 'protocol'; status?: number; message: string };

const post = (message: OllamaStreamResponse) => (self as DedicatedWorkerGlobalScope).postMessage(message);

self.onmessage = async (event: MessageEvent<OllamaStreamRequest>) => {
  const { baseUrl, model, systemPrompt, notes, temperature } = event.data;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      // Never send the session cookie to the local model process. Cookies ignore the port, so on a
      // localhost API this would otherwise leak the JWT — and Ollama's wildcard CORS header would
      // make the browser reject the response anyway.
      credentials: 'omit',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: true,
        options: { temperature },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: notes },
        ],
      }),
    });
  } catch (error) {
    // A refused connection, a mixed-content block and a Private Network Access denial are
    // indistinguishable here — all three surface as an opaque TypeError. The caller turns this into
    // guidance based on the page's own scheme.
    post({
      type: 'error',
      kind: 'unreachable',
      message: error instanceof Error ? error.message : 'Failed to reach the local model',
    });
    return;
  }

  if (!response.ok || !response.body) {
    post({
      type: 'error',
      kind: 'http',
      status: response.status,
      message: `Ollama answered ${response.status}`,
    });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let lineBuffer = '';   // holds the trailing partial NDJSON line between chunks
  let pendingDelta = ''; // text produced but not yet posted
  let fullText = '';
  let lastFlush = performance.now();

  const flush = (force: boolean) => {
    if (!pendingDelta) return;
    if (!force && performance.now() - lastFlush < FLUSH_INTERVAL_MS) return;
    post({ type: 'delta', text: pendingDelta });
    pendingDelta = '';
    lastFlush = performance.now();
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      lineBuffer += decoder.decode(value, { stream: true });

      // Ollama streams newline-delimited JSON, and a chunk boundary can fall mid-record; the
      // remainder is carried over until the next read completes it.
      const { lines, rest } = takeCompleteLines(lineBuffer);
      lineBuffer = rest;

      for (const line of lines) {
        const content = extractStreamedContent(line);
        if (content) {
          pendingDelta += content;
          fullText += content;
        }
      }

      flush(false);
    }

    // A well-formed stream ends on a newline, so anything left here is a truncated final record.
    const trailing = extractStreamedContent(lineBuffer);
    if (trailing) {
      pendingDelta += trailing;
      fullText += trailing;
    }

    flush(true);
    post({ type: 'done', text: fullText });
  } catch (error) {
    post({
      type: 'error',
      kind: 'protocol',
      message: error instanceof Error ? error.message : 'Malformed stream from the local model',
    });
  }
};
