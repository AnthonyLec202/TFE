import { describe, it, expect } from 'vitest';
import { reflowRecognizedLines } from './reflowRecognizedLines';
import type { RecognizedLine } from '../types/handwriting';

/** Builds a line, explicit and prose by default — the safe end of every ambiguity. */
function line(text: string, overrides: Partial<RecognizedLine> = {}): RecognizedLine {
  return { text, isExplicitBreak: true, kind: 'text', ...overrides };
}

/** A line the recognizer reported as a wrap rather than a decision. */
function wrapped(text: string, overrides: Partial<RecognizedLine> = {}): RecognizedLine {
  return line(text, { ...overrides, isExplicitBreak: false });
}

describe('reflowRecognizedLines', () => {
  describe('folding wrapped lines', () => {
    it('merges a sentence the writer wrapped across three lines into one paragraph', () => {
      // The reported defect: "Bonjour, ça va" written one word per line on a narrow sheet.
      const blocks = reflowRecognizedLines([
        line('Bonjour,'),
        wrapped('ça'),
        wrapped('va'),
      ]);

      expect(blocks).toEqual([{ kind: 'paragraph', text: 'Bonjour, ça va' }]);
    });

    it('keeps deliberate line breaks as separate paragraphs', () => {
      const blocks = reflowRecognizedLines([
        line('Séance du matin.'),
        line('Le patient est calme.'),
      ]);

      expect(blocks).toEqual([
        { kind: 'paragraph', text: 'Séance du matin.' },
        { kind: 'paragraph', text: 'Le patient est calme.' },
      ]);
    });

    it('mixes both: a wrapped sentence followed by a deliberate new paragraph', () => {
      const blocks = reflowRecognizedLines([
        line('Le patient se présente'),
        wrapped('calme et coopératif.'),
        line('Objectif de la séance :'),
        wrapped('travail sur la mémoire.'),
      ]);

      expect(blocks).toEqual([
        { kind: 'paragraph', text: 'Le patient se présente calme et coopératif.' },
        { kind: 'paragraph', text: 'Objectif de la séance : travail sur la mémoire.' },
      ]);
    });

    it('opens a block on the first line even when it claims to be a wrap', () => {
      // Nothing precedes it, so there is nothing to fold into.
      const blocks = reflowRecognizedLines([wrapped('Bonjour'), wrapped('ça va')]);

      expect(blocks).toEqual([{ kind: 'paragraph', text: 'Bonjour ça va' }]);
    });

    it('treats a missing isExplicitBreak flag as deliberate', () => {
      // An older API build, or a provider response we could not annotate. Splitting is recoverable;
      // merging two clinical notes is not. The closing full stop is what the rule reads — the flag
      // being absent is what this test is about.
      const blocks = reflowRecognizedLines([
        line('Première note.'),
        { text: 'Seconde note', kind: 'text' } as RecognizedLine,
      ]);

      expect(blocks).toEqual([
        { kind: 'paragraph', text: 'Première note.' },
        { kind: 'paragraph', text: 'Seconde note' },
      ]);
    });
  });

  describe('linguistic continuation rule', () => {
    it('merges words stacked one per line even when the recognizer called each break deliberate', () => {
      // The originally reported case. Writing one word per line leaves room at the end of every line,
      // so the recognizer reports every break as deliberate — the text is what says otherwise.
      const blocks = reflowRecognizedLines([line('Bonjour,'), line('ça'), line('va')]);

      expect(blocks).toEqual([{ kind: 'paragraph', text: 'Bonjour, ça va' }]);
    });

    it('does not merge across terminal punctuation', () => {
      const blocks = reflowRecognizedLines([line('Le patient est calme.'), line('objectif atteint')]);

      expect(blocks).toEqual([
        { kind: 'paragraph', text: 'Le patient est calme.' },
        { kind: 'paragraph', text: 'objectif atteint' },
      ]);
    });

    it('merges regardless of how the next line is capitalised', () => {
      // A writer forming "Ça" and "Va" with capitals out of habit used to be denied the merge, with
      // nothing on screen to explain why the same sentence behaved differently from one note to the
      // next. Capitalisation carries no weight: only punctuation delimits.
      const blocks = reflowRecognizedLines([line('Bonjour,'), line('Ça'), line('Va')]);

      expect(blocks).toEqual([{ kind: 'paragraph', text: 'Bonjour, Ça Va' }]);
    });

    it('preserves the recognized casing verbatim when merging', () => {
      const blocks = reflowRecognizedLines([line('bilan'), line('École primaire')]);

      expect(blocks).toEqual([{ kind: 'paragraph', text: 'bilan École primaire' }]);
    });

    it('merges two unpunctuated sentences — the cost of delimiting on punctuation alone', () => {
      // Encoded deliberately. Closing the first line would keep them apart.
      const blocks = reflowRecognizedLines([
        line('Le patient est calme'),
        line('Il a bien dormi'),
      ]);

      expect(blocks).toEqual([
        { kind: 'paragraph', text: 'Le patient est calme Il a bien dormi' },
      ]);
    });

    it('keeps a heading on its own line when it ends with a colon', () => {
      const blocks = reflowRecognizedLines([line('Anamnèse :'), line('difficultés scolaires')]);

      expect(blocks).toEqual([
        { kind: 'paragraph', text: 'Anamnèse :' },
        { kind: 'paragraph', text: 'difficultés scolaires' },
      ]);
    });

    it('merges a bare heading into its content — the documented cost of the rule', () => {
      // Encoded deliberately: without the colon a heading is indistinguishable from a wrapped
      // sentence. Ending it with punctuation is what separates the two cases.
      const blocks = reflowRecognizedLines([line('Anamnèse'), line('difficultés scolaires')]);

      expect(blocks).toEqual([{ kind: 'paragraph', text: 'Anamnèse difficultés scolaires' }]);
    });

    it('treats punctuation followed by a closing quote as terminal', () => {
      const blocks = reflowRecognizedLines([line('il a dit « non ».'), line('puis il est parti')]);

      expect(blocks).toEqual([
        { kind: 'paragraph', text: 'il a dit « non ».' },
        { kind: 'paragraph', text: 'puis il est parti' },
      ]);
    });

    it('measures against the accumulated text, not the last fragment folded into it', () => {
      // "séance." is what the unit now ends with, even though it arrived as a wrap.
      const blocks = reflowRecognizedLines([
        line('Fin de'),
        wrapped('séance.'),
        line('remarques diverses'),
      ]);

      expect(blocks).toEqual([
        { kind: 'paragraph', text: 'Fin de séance.' },
        { kind: 'paragraph', text: 'remarques diverses' },
      ]);
    });

    it('never overrides list structure', () => {
      const blocks = reflowRecognizedLines([
        line('attention', { kind: 'listItem', bulletKind: 'bullet' }),
        line('fatigue', { kind: 'listItem', bulletKind: 'bullet' }),
      ]);

      expect(blocks).toEqual([
        { kind: 'list', ordered: false, items: ['attention', 'fatigue'] },
      ]);
    });

    it('does not pull a list item into the prose above it', () => {
      const blocks = reflowRecognizedLines([
        line('observations'),
        line('attention soutenue', { kind: 'listItem', bulletKind: 'bullet' }),
      ]);

      expect(blocks).toEqual([
        { kind: 'paragraph', text: 'observations' },
        { kind: 'list', ordered: false, items: ['attention soutenue'] },
      ]);
    });

    it('is overruled by deliberate blank space', () => {
      // Geometry and language must agree. The first two lines set the writer's pitch at 13; the third
      // sits 37 below its predecessor, so the space before it reads as deliberate.
      const blocks = reflowRecognizedLines([
        line('Bonjour,', { top: 0, bottom: 10 }),
        line('ça', { top: 13, bottom: 23 }),
        line('va', { top: 50, bottom: 60 }),
      ]);

      expect(blocks).toEqual([
        { kind: 'paragraph', text: 'Bonjour, ça' },
        { kind: 'paragraph', text: 'va' },
      ]);
    });

    it('merges short stacked words that ordinary line spacing separates', () => {
      // The regression this rule was rewritten for. Ink heights here are 10, 6 and 5 — a lowercase
      // word occupies a fraction of the line it sits on — while the pitch is a steady 16. Measuring
      // the gap against ink height declared every one of these lines deliberately separated.
      const blocks = reflowRecognizedLines([
        line('Bonjour,', { top: 0, bottom: 10 }),
        line('ça', { top: 16, bottom: 22 }),
        line('va', { top: 32, bottom: 37 }),
      ]);

      expect(blocks).toEqual([{ kind: 'paragraph', text: 'Bonjour, ça va' }]);
    });

    it('does not veto on geometry when only two lines are available', () => {
      // One advance cannot establish a rhythm — it can never exceed a multiple of itself — so the
      // flag and the text decide alone. Documented rather than worked around: inventing a pitch from
      // a single measurement would veto merges arbitrarily.
      const blocks = reflowRecognizedLines([
        line('Bonjour,', { top: 0, bottom: 10 }),
        line('ça va', { top: 200, bottom: 210 }),
      ]);

      expect(blocks).toEqual([{ kind: 'paragraph', text: 'Bonjour, ça va' }]);
    });
  });

  describe('blank-space geometry rule', () => {
    it('splits a wrapped line that sits a full line below its predecessor', () => {
      // The first two lines establish a pitch of 13; the third advances 25, close to double — the
      // writer skipped a line, which a wrap never does.
      const blocks = reflowRecognizedLines([
        line('Antécédents', { top: 0, bottom: 10 }),
        wrapped('familiaux', { top: 13, bottom: 23 }),
        wrapped('Traitement en cours', { top: 38, bottom: 48 }),
      ]);

      expect(blocks).toEqual([
        { kind: 'paragraph', text: 'Antécédents familiaux' },
        { kind: 'paragraph', text: 'Traitement en cours' },
      ]);
    });

    it('still merges wrapped lines at normal interline spacing', () => {
      const blocks = reflowRecognizedLines([
        line('Antécédents', { top: 0, bottom: 10 }),
        wrapped('familiaux', { top: 13, bottom: 23 }),
        wrapped('notables', { top: 26, bottom: 36 }),
      ]);

      expect(blocks).toEqual([
        { kind: 'paragraph', text: 'Antécédents familiaux notables' },
      ]);
    });

    it('does not merge on tight spacing alone', () => {
      // Geometry may only split, never merge. These two lines sit close together and are still kept
      // apart, because nothing in the text asks for them to be joined.
      const blocks = reflowRecognizedLines([
        line('Note A.', { top: 0, bottom: 10 }),
        line('Note B', { top: 11, bottom: 21 }),
      ]);

      expect(blocks).toEqual([
        { kind: 'paragraph', text: 'Note A.' },
        { kind: 'paragraph', text: 'Note B' },
      ]);
    });

    it('falls back to the flag alone when geometry is absent', () => {
      const blocks = reflowRecognizedLines([line('Bonjour,'), wrapped('ça va')]);

      expect(blocks).toEqual([{ kind: 'paragraph', text: 'Bonjour, ça va' }]);
    });

    it('ignores geometry present on only one of the two lines', () => {
      const blocks = reflowRecognizedLines([
        line('Bonjour,', { top: 0, bottom: 10 }),
        wrapped('ça va'),
      ]);

      expect(blocks).toEqual([{ kind: 'paragraph', text: 'Bonjour, ça va' }]);
    });
  });

  describe('lists', () => {
    it('gathers consecutive bullet items into a single unordered list', () => {
      const blocks = reflowRecognizedLines([
        line('Observations :'),
        line('attention soutenue', { kind: 'listItem', bulletKind: 'bullet' }),
        line('fatigue en fin de séance', { kind: 'listItem', bulletKind: 'bullet' }),
      ]);

      expect(blocks).toEqual([
        { kind: 'paragraph', text: 'Observations :' },
        {
          kind: 'list',
          ordered: false,
          items: ['attention soutenue', 'fatigue en fin de séance'],
        },
      ]);
    });

    it('marks numbered and lettered bullets as ordered', () => {
      const numbered = reflowRecognizedLines([
        line('premier', { kind: 'listItem', bulletKind: 'number' }),
      ]);
      const lettered = reflowRecognizedLines([
        line('premier', { kind: 'listItem', bulletKind: 'letter' }),
      ]);

      expect(numbered).toEqual([{ kind: 'list', ordered: true, items: ['premier'] }]);
      expect(lettered).toEqual([{ kind: 'list', ordered: true, items: ['premier'] }]);
    });

    it('treats checkboxes as unordered', () => {
      const blocks = reflowRecognizedLines([
        line('à revoir', { kind: 'listItem', bulletKind: 'check' }),
      ]);

      expect(blocks).toEqual([{ kind: 'list', ordered: false, items: ['à revoir'] }]);
    });

    it('folds a wrapped continuation into the list item it belongs to', () => {
      const blocks = reflowRecognizedLines([
        line('travail sur la', { kind: 'listItem', bulletKind: 'bullet' }),
        wrapped('mémoire de travail', { kind: 'listItem', bulletKind: 'bullet' }),
        line('exercices de calcul', { kind: 'listItem', bulletKind: 'bullet' }),
      ]);

      expect(blocks).toEqual([
        {
          kind: 'list',
          ordered: false,
          items: ['travail sur la mémoire de travail', 'exercices de calcul'],
        },
      ]);
    });

    it('starts a new list when the ordering changes', () => {
      const blocks = reflowRecognizedLines([
        line('un', { kind: 'listItem', bulletKind: 'bullet' }),
        line('deux', { kind: 'listItem', bulletKind: 'number' }),
      ]);

      expect(blocks).toEqual([
        { kind: 'list', ordered: false, items: ['un'] },
        { kind: 'list', ordered: true, items: ['deux'] },
      ]);
    });

    it('separates two lists split by a paragraph', () => {
      const blocks = reflowRecognizedLines([
        line('un', { kind: 'listItem', bulletKind: 'bullet' }),
        line('Commentaire.'),
        line('deux', { kind: 'listItem', bulletKind: 'bullet' }),
      ]);

      expect(blocks).toEqual([
        { kind: 'list', ordered: false, items: ['un'] },
        { kind: 'paragraph', text: 'Commentaire.' },
        { kind: 'list', ordered: false, items: ['deux'] },
      ]);
    });

    it('treats a list item with no bullet kind as unordered', () => {
      const blocks = reflowRecognizedLines([line('un', { kind: 'listItem' })]);

      expect(blocks).toEqual([{ kind: 'list', ordered: false, items: ['un'] }]);
    });
  });

  describe('malformed input', () => {
    it('returns no blocks for an empty transcription', () => {
      expect(reflowRecognizedLines([])).toEqual([]);
    });

    it('returns no blocks when nothing was passed at all', () => {
      expect(reflowRecognizedLines(undefined as unknown as RecognizedLine[])).toEqual([]);
      expect(reflowRecognizedLines(null as unknown as RecognizedLine[])).toEqual([]);
    });

    it('drops blank and whitespace-only lines', () => {
      const blocks = reflowRecognizedLines([
        line('Bonjour'),
        line('   '),
        line(''),
        wrapped('ça va'),
      ]);

      expect(blocks).toEqual([{ kind: 'paragraph', text: 'Bonjour ça va' }]);
    });

    it('trims surrounding whitespace on every line before joining', () => {
      const blocks = reflowRecognizedLines([line('  Bonjour,  '), wrapped('  ça va  ')]);

      expect(blocks).toEqual([{ kind: 'paragraph', text: 'Bonjour, ça va' }]);
    });

    it('skips entries that carry no usable text without throwing', () => {
      const blocks = reflowRecognizedLines([
        line('Bonjour.'),
        null as unknown as RecognizedLine,
        { kind: 'text', isExplicitBreak: true } as unknown as RecognizedLine,
        { text: 42, isExplicitBreak: true, kind: 'text' } as unknown as RecognizedLine,
        line('Au revoir'),
      ]);

      expect(blocks).toEqual([
        { kind: 'paragraph', text: 'Bonjour.' },
        { kind: 'paragraph', text: 'Au revoir' },
      ]);
    });

    it('treats an unknown line kind as prose', () => {
      const blocks = reflowRecognizedLines([
        { text: 'Bonjour', isExplicitBreak: true, kind: 'heading' } as unknown as RecognizedLine,
      ]);

      expect(blocks).toEqual([{ kind: 'paragraph', text: 'Bonjour' }]);
    });
  });
});
