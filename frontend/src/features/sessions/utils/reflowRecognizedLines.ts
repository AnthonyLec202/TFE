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
 * THE BIAS
 * Every ambiguity resolves towards keeping lines apart. A missing flag, an unknown bullet kind, an
 * absent annotation — all read as "deliberate". Wrongly splitting a sentence is a cosmetic defect the
 * clinician fixes with one keystroke; wrongly merging two notes destroys the distinction between them
 * in a clinical record. The geometry rule below follows the same bias: it can only ever split.
 *
 * Pure: no React, no I/O, no DOM.
 */
import type { RecognizedLine, RecognizedLineKind } from '../types/handwriting';

/** A run of text the writer meant to hold together. */
export type RecognizedBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] };

/**
 * How far below its predecessor a line must sit, relative to the median line height, before it is
 * treated as separated by deliberate blank space rather than merely wrapped.
 *
 * Normal interline spacing leaves a gap of roughly 0.3–0.8 line heights between one line's descenders
 * and the next line's ascenders; skipping a line pushes that to about 1.6 and beyond. 1.2 sits
 * between the two populations.
 */
const BLANK_LINE_GAP_RATIO = 1.2;

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

  const medianHeight = medianLineHeight(contentLines);
  const units: LineUnit[] = [];

  contentLines.forEach((line, index) => {
    const text = line.text.trim();

    // Only an explicit `false` licenses folding this line into its predecessor. Note the first line
    // always opens a unit regardless of what it claims: it has nothing to be folded into.
    const isWrap =
      units.length > 0 &&
      line.isExplicitBreak === false &&
      !isSeparatedByBlankSpace(contentLines[index - 1], line, medianHeight);

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
  medianHeight: number | null,
): boolean {
  if (!previous || medianHeight === null) return false;
  if (typeof previous.bottom !== 'number' || typeof line.top !== 'number') return false;
  return line.top - previous.bottom > medianHeight * BLANK_LINE_GAP_RATIO;
}

/** Median ink height across the lines that reported geometry; null when none did. */
function medianLineHeight(lines: RecognizedLine[]): number | null {
  const heights = lines
    .map(line =>
      typeof line.top === 'number' && typeof line.bottom === 'number'
        ? line.bottom - line.top
        : null,
    )
    .filter((height): height is number => height !== null && height > 0)
    .sort((a, b) => a - b);

  if (heights.length === 0) return null;

  const middle = Math.floor(heights.length / 2);
  return heights.length % 2 === 0
    ? (heights[middle - 1] + heights[middle]) / 2
    : heights[middle];
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
