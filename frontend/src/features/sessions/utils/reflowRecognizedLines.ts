/**
 * Folds the recognizer's visual lines back into the blocks the writer actually intended.
 *
 * THE PROBLEM THIS SOLVES
 * The recognizer segments handwriting into visual lines and reports them separated by newlines.
 * Rendering one paragraph per line turns a sentence the writer merely wrapped — because the sheet ran
 * out of horizontal room — into several disconnected paragraphs: "Bonjour, ça va" written on three
 * lines came out as three notes.
 *
 * THE SIGNAL
 * The provider distinguishes the two cases itself: a line break is *explicit* when the writer went to
 * the next line although the word still fitted at the end of the previous one, and *implicit* when
 * they simply ran out of room. An implicit break is a wrap and folds back; an explicit one is a
 * decision and is preserved, as are list items and their bullet flavour.
 *
 * THE SECOND SIGNAL
 * The provider's judgement is geometric: it calls a break deliberate whenever room was left at the
 * end of the previous line. A clinician who habitually writes one or two words per line therefore
 * produces "deliberate" breaks throughout, and the transcription comes back as a column of
 * fragments. So a line the provider called deliberate is folded back anyway unless the line above it
 * ends on terminal punctuation. Geometry and punctuation have to agree before a break survives.
 *
 * THE CONTRACT
 * Punctuation, and only punctuation, delimits. End a line with "." "!" "?" "…" or ":" and it stays
 * its own paragraph; end it any other way and the next line joins it. That is a rule the writer can
 * predict and control, which is the point — nothing else about how they happened to form the letters
 * changes the outcome.
 *
 * THE BIAS
 * Missing data resolves towards keeping lines apart: an absent flag, an unknown bullet kind, an
 * unreadable annotation all read as "deliberate". Lists are never overridden — their structure is
 * explicit — and the geometry rule below can only ever split.
 *
 * KNOWN COST
 * A line the writer meant to stand alone but left unpunctuated is merged into the next: a bare
 * heading ("Anamnèse" above "difficultés scolaires"), or two sentences neither of which was closed.
 * Ending the line with punctuation is what separates the cases, which is why ":" — the mark a
 * heading naturally takes — counts as terminal here.
 *
 * Pure: no React, no I/O, no DOM.
 */
import type { RecognizedLine, RecognizedLineKind } from '../types/handwriting';

/** A run of text the writer meant to hold together. */
export type RecognizedBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] };

/**
 * How much further apart than the writer's own tightest line pitch two lines must sit before the
 * space between them reads as deliberate.
 *
 * Expressed in multiples of the pitch, so skipping a line lands near 2.0 while ordinary variation in
 * handwriting stays well under 1.5. 1.7 sits between the two populations.
 */
const BLANK_LINE_PITCH_RATIO = 1.7;

/**
 * Punctuation that closes a thought, optionally followed by a closing quote or bracket.
 *
 * The colon is deliberately in the set: it is what distinguishes a heading the writer wants on its
 * own line ("Anamnèse :") from a sentence that merely ran on ("Bonjour,").
 */
const SENTENCE_END_PATTERN = /[.!?…:][")\]»']*$/;

/** One logical line: a visual line plus every wrapped continuation folded into it. */
interface LineUnit {
  text: string;
  kind: RecognizedLineKind;
  ordered: boolean;
}

export function reflowRecognizedLines(lines: RecognizedLine[]): RecognizedBlock[] {
  // Defensive: this consumes a network payload, and one malformed entry must not throw on a path
  // whose whole purpose is to rescue handwriting the clinician cannot otherwise recover.
  const contentLines = (Array.isArray(lines) ? lines : []).filter(
    (line): line is RecognizedLine =>
      typeof line?.text === 'string' && line.text.trim().length > 0,
  );
  if (contentLines.length === 0) return [];

  const pitch = lineRhythm(contentLines);
  const units: LineUnit[] = [];

  contentLines.forEach((line, index) => {
    const text = line.text.trim();
    const openUnit = units[units.length - 1];

    // Folded into the line above when the provider reported a wrap, or when the provider called it
    // deliberate but the text reads as a continuation — and, either way, only if no blank space
    // separates the two. The first line has no open unit to fold into and always starts one.
    const isWrap =
      openUnit !== undefined &&
      !isSeparatedByBlankSpace(contentLines[index - 1], line, pitch) &&
      (line.isExplicitBreak === false || continuesOpenUnit(openUnit, line));

    if (!isWrap) {
      units.push({
        kind: line.kind === 'listItem' ? 'listItem' : 'text',
        ordered: isOrderedBullet(line.bulletKind),
        text,
      });
      return;
    }

    const current = units[units.length - 1];
    current.text = current.text.length > 0 ? `${current.text} ${text}` : text;
  });

  return groupUnitsIntoBlocks(units);
}

/**
 * Whether a line reads as the continuation of the text already accumulated above it, despite the
 * recognizer having called the break deliberate.
 *
 * Punctuation alone decides. An earlier version also refused to merge into a line that opened with a
 * capital, on the reasoning that a capital starts a sentence — but handwriting capitalises for many
 * reasons the transcription cannot tell apart, and a writer who begins "Ça" with a capital out of
 * habit was silently denied the merge with nothing on screen to explain why. Punctuation is a mark
 * the writer places deliberately, so the rule it drives is one they can predict and control: end a
 * sentence with one and the next line stays separate.
 *
 * Tested against the open unit rather than the previous raw line, because earlier lines may already
 * have been folded into it — what matters is how the text now ends, not how one of its fragments did.
 *
 * List structure is never overridden: an item that genuinely wrapped is already reported as implicit,
 * so anything still marked deliberate here is a new item.
 */
function continuesOpenUnit(openUnit: LineUnit, line: RecognizedLine): boolean {
  if (openUnit.kind === 'listItem' || line.kind === 'listItem') return false;
  if (openUnit.text.length === 0) return false;

  return !SENTENCE_END_PATTERN.test(openUnit.text);
}

/**
 * Whether deliberate blank space separates two lines.
 *
 * A line the provider called a wrap cannot legitimately sit a whole line height below its
 * predecessor — the writer skipped space there. This rule only ever promotes a wrap to a break, never
 * the reverse, so a provider that reports geometry we misread costs an extra paragraph at worst.
 * Absent geometry on either line disables it.
 */
function isSeparatedByBlankSpace(
  previous: RecognizedLine | undefined,
  line: RecognizedLine,
  pitch: number | null,
): boolean {
  if (!previous || pitch === null) return false;
  if (typeof previous.top !== 'number' || typeof line.top !== 'number') return false;
  // Top to top, so the measurement is a line advance and does not vary with how tall the ink on
  // either line happens to be.
  return line.top - previous.top > pitch * BLANK_LINE_PITCH_RATIO;
}

/**
 * The writer's own line pitch: the tightest top-to-top advance between consecutive lines. Null when
 * fewer than two lines reported a position.
 *
 * Derived from line positions rather than from ink heights, which is what this replaces. A line
 * carrying one short lowercase word has an ink extent a fraction of the space it occupies — "va" is
 * an x-height, "Bonjour," is an ascender plus a descender — so a figure built from ink heights
 * collapses on exactly the notes this rule most needs to read correctly: the ones written a word at a
 * time. It then declares ordinary line spacing to be a deliberate blank line and blocks the merge.
 *
 * The tightest advance is taken rather than the median because a note may hold only two or three
 * lines, too few for a median to describe anything, and because the tightest advance is the one that
 * cannot itself have a skipped line hidden inside it.
 */
function lineRhythm(lines: RecognizedLine[]): number | null {
  let tightest: number | null = null;

  for (let index = 1; index < lines.length; index++) {
    const previousTop = lines[index - 1].top;
    const top = lines[index].top;
    if (typeof previousTop !== 'number' || typeof top !== 'number') continue;

    const advance = top - previousTop;
    if (advance <= 0) continue;
    if (tightest === null || advance < tightest) tightest = advance;
  }

  return tightest;
}

/** Numbered and lettered bullets are ordered lists; bullets and checkboxes are not. */
function isOrderedBullet(bulletKind: string | null | undefined): boolean {
  return bulletKind === 'number' || bulletKind === 'letter';
}

/**
 * Turns logical lines into blocks, gathering consecutive list items of the same ordering into a
 * single list. A change of ordering starts a new list rather than mixing bullets and numbers under
 * one parent, which no editor schema would accept.
 */
function groupUnitsIntoBlocks(units: LineUnit[]): RecognizedBlock[] {
  const blocks: RecognizedBlock[] = [];

  for (const unit of units) {
    if (unit.text.length === 0) continue;

    if (unit.kind !== 'listItem') {
      blocks.push({ kind: 'paragraph', text: unit.text });
      continue;
    }

    const last = blocks[blocks.length - 1];
    if (last?.kind === 'list' && last.ordered === unit.ordered) {
      last.items.push(unit.text);
      continue;
    }

    blocks.push({ kind: 'list', ordered: unit.ordered, items: [unit.text] });
  }

  return blocks;
}
