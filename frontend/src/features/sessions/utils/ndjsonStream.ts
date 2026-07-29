/**
 * Pure helpers for consuming Ollama's newline-delimited JSON stream.
 *
 * Kept out of the worker so the one genuinely error-prone part of streaming — reassembling records
 * that straddle two network chunks — is testable in isolation. Getting this wrong truncates or
 * duplicates clinical text without any error surfacing.
 */

/**
 * Splits a decode buffer into the JSON records that are definitely complete, plus the remainder.
 *
 * A chunk boundary can fall anywhere, including mid-record, so the trailing segment is only complete
 * when the buffer ends on a newline. Everything after the last newline is handed back as `rest` for
 * the next chunk to finish.
 */
export function takeCompleteLines(buffered: string): { lines: string[]; rest: string } {
  const segments = buffered.split('\n');
  // Always held back: it is either a partial record, or the empty string left by a trailing newline.
  const rest = segments.pop() ?? '';
  return { lines: segments.filter(line => line.trim().length > 0), rest };
}

/**
 * Extracts the text a single stream record contributes.
 *
 * Returns '' for anything that carries no usable content — the terminal `{"done":true}` record, a
 * record whose `message.content` is absent, or a malformed one. Ollama has no reason to emit
 * unparseable JSON, but a truncated or proxied response can: swallowing it here keeps a single bad
 * record from aborting a generation that is otherwise complete.
 */
export function extractStreamedContent(line: string): string {
  try {
    const record: unknown = JSON.parse(line);
    const content = (record as { message?: { content?: unknown } })?.message?.content;
    return typeof content === 'string' ? content : '';
  } catch {
    return '';
  }
}
