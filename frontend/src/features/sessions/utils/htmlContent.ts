// Pure HTML/plain-text helpers for the session-note feature. No React, no I/O — only the browser's
// DOMParser used as a string transformer.

/**
 * Converts a TipTap HTML payload to plain text for the handwriting-canvas preview, which renders raw
 * text and cannot interpret markup (otherwise it would show literal tags like "<p>Bonjour</p>").
 */
export function htmlToPlainText(html: string): string {
  return new DOMParser().parseFromString(html, 'text/html').body.textContent || '';
}

/**
 * Appends OCR-recognized text to the existing HTML note as <p> blocks, so TipTap re-parses it
 * cleanly when the user switches back to keyboard mode. The recognized text is HTML-escaped so stray
 * angle brackets can never inject markup.
 *
 * One paragraph per recognized line: the recognizer separates the lines it segmented with newlines,
 * and HTML collapses those into spaces — a single wrapping <p> turned a handwritten page into one
 * run-on paragraph.
 */
export function appendRecognizedTextToHtml(existingHtml: string, recognizedText: string): string {
  const paragraphs = recognizedText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => `<p>${escapeHtml(line)}</p>`)
    .join('');

  if (paragraphs.length === 0) return existingHtml;
  return existingHtml.trim().length > 0 ? `${existingHtml}${paragraphs}` : paragraphs;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
