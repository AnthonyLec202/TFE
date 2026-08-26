import { describe, it, expect } from 'vitest';
import { appendRecognizedTextToHtml } from './htmlContent';
import type { RecognitionResult, RecognizedLine } from '../types/handwriting';

function line(text: string, overrides: Partial<RecognizedLine> = {}): RecognizedLine {
  return { text, isExplicitBreak: true, kind: 'text', ...overrides };
}

function recognition(lines: RecognizedLine[]): RecognitionResult {
  return { text: lines.map(l => l.text).join('\n'), lines };
}

describe('appendRecognizedTextToHtml', () => {
  it('renders a sentence wrapped over three lines as a single paragraph', () => {
    const result = appendRecognizedTextToHtml(
      '',
      recognition([
        line('Bonjour,'),
        line('ça', { isExplicitBreak: false }),
        line('va', { isExplicitBreak: false }),
      ]),
    );

    expect(result).toBe('<p>Bonjour, ça va</p>');
  });

  it('appends after existing note content rather than replacing it', () => {
    const result = appendRecognizedTextToHtml('<p>Note précédente</p>', recognition([line('Suite')]));

    expect(result).toBe('<p>Note précédente</p><p>Suite</p>');
  });

  it('drops the existing markup when it holds no text', () => {
    // TipTap serialises an empty document as "<p></p>"; appending to it would leave a blank
    // paragraph at the top of every converted note.
    const result = appendRecognizedTextToHtml('<p></p>', recognition([line('Bonjour')]));

    expect(result).toBe('<p>Bonjour</p>');
  });

  it('renders list items as a TipTap-parseable list', () => {
    const result = appendRecognizedTextToHtml(
      '',
      recognition([
        line('attention', { kind: 'listItem', bulletKind: 'bullet' }),
        line('fatigue', { kind: 'listItem', bulletKind: 'bullet' }),
      ]),
    );

    // StarterKit's listItem node accepts block content, so each item wraps its text in a paragraph.
    expect(result).toBe('<ul><li><p>attention</p></li><li><p>fatigue</p></li></ul>');
  });

  it('renders numbered bullets as an ordered list', () => {
    const result = appendRecognizedTextToHtml(
      '',
      recognition([line('premier', { kind: 'listItem', bulletKind: 'number' })]),
    );

    expect(result).toBe('<ol><li><p>premier</p></li></ol>');
  });

  it('escapes angle brackets and ampersands in recognized text', () => {
    const result = appendRecognizedTextToHtml(
      '',
      recognition([line('<script>alert(1)</script> & co')]),
    );

    expect(result).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; co</p>');
  });

  it('escapes recognized text inside list items too', () => {
    const result = appendRecognizedTextToHtml(
      '',
      recognition([line('a < b', { kind: 'listItem', bulletKind: 'bullet' })]),
    );

    expect(result).toBe('<ul><li><p>a &lt; b</p></li></ul>');
  });

  it('leaves the note untouched when nothing was recognized', () => {
    expect(appendRecognizedTextToHtml('<p>Intact</p>', { text: '', lines: [] })).toBe('<p>Intact</p>');
  });

  describe('fallback for an API without per-line annotation', () => {
    it('renders one paragraph per newline-separated line', () => {
      const result = appendRecognizedTextToHtml('', { text: 'Bonjour,\nça\nva', lines: [] });

      expect(result).toBe('<p>Bonjour,</p><p>ça</p><p>va</p>');
    });

    it('tolerates a response carrying no lines field at all', () => {
      const result = appendRecognizedTextToHtml(
        '',
        { text: 'Bonjour' } as unknown as RecognitionResult,
      );

      expect(result).toBe('<p>Bonjour</p>');
    });

    it('handles CRLF line endings and skips blank lines', () => {
      const result = appendRecognizedTextToHtml('', { text: 'Un\r\n\r\nDeux', lines: [] });

      expect(result).toBe('<p>Un</p><p>Deux</p>');
    });
  });
});
