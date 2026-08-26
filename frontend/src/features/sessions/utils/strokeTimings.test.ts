import { describe, it, expect } from 'vitest';
import { normalizeStrokeTimings } from './strokeTimings';
import type { Stroke } from '../types/handwriting';

/** Builds a stroke from timestamps alone; coordinates are irrelevant here but must survive. */
function strokeAt(...timestamps: number[]): Stroke {
  return timestamps.map((t, index) => ({ x: index, y: index * 2, t }));
}

/** Flattens the timestamps back out, which is all these assertions are about. */
function timings(strokes: Stroke[]): number[][] {
  return strokes.map(stroke => stroke.map(point => point.t));
}

describe('normalizeStrokeTimings', () => {
  it('rebases a single-clock batch to zero and keeps every interval', () => {
    const result = normalizeStrokeTimings([strokeAt(1000, 1010, 1025), strokeAt(1200, 1215)]);

    expect(timings(result)).toEqual([[0, 10, 25], [200, 215]]);
  });

  it('preserves x and y while rewriting only t', () => {
    const result = normalizeStrokeTimings([strokeAt(500, 510)]);

    expect(result).toEqual([[
      { x: 0, y: 0, t: 0 },
      { x: 1, y: 2, t: 10 },
    ]]);
  });

  it('collapses the leap from a page-relative clock to the epoch clock', () => {
    // The exact scenario: strokes written before the fix, then more written after a reload.
    const pageRelative = strokeAt(4000, 4020);
    const epoch = strokeAt(1_760_000_000_000, 1_760_000_000_030);

    const result = normalizeStrokeTimings([pageRelative, epoch]);

    // The 1.7e12 step becomes a nominal pen lift; the intervals inside each stroke survive.
    expect(timings(result)).toEqual([[0, 20], [170, 200]]);
  });

  it('repairs a batch that steps backwards at a stroke boundary', () => {
    // Two page loads: the second restarted the page clock lower than the first reached.
    const result = normalizeStrokeTimings([strokeAt(9000, 9050), strokeAt(120, 140)]);

    expect(timings(result)).toEqual([[0, 50], [200, 220]]);
  });

  it('keeps a long but plausible pause between strokes', () => {
    // The clinician held the pen for eight seconds. That is a real signal, not an artefact.
    const result = normalizeStrokeTimings([strokeAt(1000), strokeAt(9000)]);

    expect(timings(result)).toEqual([[0], [8000]]);
  });

  it('substitutes a pen lift for a pause beyond what a pause can be', () => {
    const result = normalizeStrokeTimings([strokeAt(1000), strokeAt(1000 + 60_001)]);

    expect(timings(result)).toEqual([[0], [150]]);
  });

  it('keeps a pause exactly at the plausibility limit', () => {
    const result = normalizeStrokeTimings([strokeAt(1000), strokeAt(1000 + 60_000)]);

    expect(timings(result)).toEqual([[0], [60_000]]);
  });

  it('never steps backwards, whatever the input does', () => {
    const result = normalizeStrokeTimings([
      strokeAt(5000, 5010),
      strokeAt(10, 20),
      strokeAt(999_999_999_999),
      strokeAt(3000, 3100),
    ]);

    const flat = timings(result).flat();
    const isMonotonic = flat.every((value, index) => index === 0 || value >= flat[index - 1]);

    expect(isMonotonic).toBe(true);
    expect(flat[0]).toBe(0);
  });

  it('returns an empty batch unchanged', () => {
    expect(normalizeStrokeTimings([])).toEqual([]);
  });

  it('tolerates empty strokes without disturbing the running clock', () => {
    const result = normalizeStrokeTimings([strokeAt(1000, 1010), [], strokeAt(1100)]);

    expect(timings(result)).toEqual([[0, 10], [], [100]]);
  });

  it('does not mutate the strokes it was given', () => {
    const original = strokeAt(1000, 1010);
    const snapshot = JSON.parse(JSON.stringify(original));

    normalizeStrokeTimings([original]);

    expect(original).toEqual(snapshot);
  });
});
