// Pure HTML/plain-text helpers for the session-note feature. No React, no I/O — only the browser's
// DOMParser used as a string transformer.
import type { RecognitionResult } from '../types/handwriting';
import { reflowRecognizedLines, type RecognizedBlock } from './reflowRecognizedLines';

/**
 * Converts a TipTap HTML payload to plain text for the handwriting-canvas preview, which renders raw
 * text and cannot interpret markup (otherwise it would show literal tags like "<p>Bonjour</p>").
 */
export function htmlToPlainText(html: string): string {
  return new DOMParser().parseFromString(html, 'text/html').body.textContent || '';
}

/**
 * Appends a transcription to the existing HTML note as TipTap-parseable blocks, so the editor
 * re-parses it cleanly when the user switches back to keyboard mode. Recognized text is HTML-escaped
 * so stray angle brackets can never inject markup.
 *
 * Layout comes from `reflowRecognizedLines`: a line the writer merely wrapped is folded back into its
 * sentence, a deliberate break opens a new paragraph, and list items are gathered under a single
 * list. See that module for why every ambiguity resolves towards keeping lines apart.
 */
export function appendRecognizedTextToHtml(
  existingHtml: string,
  recognition: RecognitionResult,
): string {
  const blocks = recognition?.lines?.length
    ? reflowRecognizedLines(recognition.lines)
    : blocksFromFlatText(recognition?.text ?? '');

  const markup = blocks.map(renderBlock).join('');
  if (markup.length === 0) return existingHtml;
  return isEmptyDocument(existingHtml) ? markup : `${existingHtml}${markup}`;
}

/**
 * An editor document holding nothing the clinician wrote.
 *
 * Tested against the exact serializations TipTap produces for an empty document — the empty string,
 * and any run of empty paragraphs — rather than by stripping tags and checking for leftover text. A
 * generic "has no text" test would also call a note holding only a horizontal rule empty, and this
 * decides whether that markup is kept or dropped.
 */
function isEmptyDocument(html: string): boolean {
  return /^\s*(<p>(?:\s|&nbsp;)*<\/p>\s*)*$/.test(html);
}

/**
 * Fallback for a transcription that carries no per-line annotation — an API that predates them, or a
 * provider response whose layout analysis could not be trusted. One paragraph per line: the
 * behaviour this feature had before the reflow rule, and the conservative reading of a bare string.
 */
function blocksFromFlatText(text: string): RecognizedBlock[] {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => ({ kind: 'paragraph' as const, text: line }));
}

/**
 * Renders one block as TipTap-compatible markup. List items wrap their text in a paragraph because
 * StarterKit's listItem node accepts block content, not inline text.
 */
function renderBlock(block: RecognizedBlock): string {
  if (block.kind === 'paragraph') return `<p>${escapeHtml(block.text)}</p>`;

  const tag = block.ordered ? 'ol' : 'ul';
  const items = block.items.map(item => `<li><p>${escapeHtml(item)}</p></li>`).join('');
  return `<${tag}>${items}</${tag}>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
