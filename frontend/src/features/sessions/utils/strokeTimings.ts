/**
 * Reconciles the timestamps of a stroke batch before it is handed to the recognizer.
 *
 * WHY A BATCH CAN HOLD TWO CLOCKS
 * Strokes are persisted unconverted and written back to later, so one note's pending batch can span
 * several page loads. Timestamps captured before the epoch-clock fix are page-relative, and
 * `performance.timeOrigin` restarts with every reload — so the batch can step backwards at a stroke
 * boundary, or leap by the ~1.7 × 10¹² ms between a page-relative stamp and an epoch one. The
 * recognizer reads the spacing between points as writing speed and pen lifts; either artefact is
 * nonsense to it.
 *
 * WHAT THIS GUARANTEES
 * The result starts at zero and never steps backwards, and no gap exceeds what a pen lift can
 * plausibly be. A batch captured entirely on one clock passes through with its intervals intact —
 * only rebased — so this costs nothing in the normal case.
 *
 * Pure: no React, no I/O.
 */
import type { Stroke, StrokePoint } from '../types/handwriting';

/**
 * Longest step kept as a genuine pause. A clinician can legitimately hold the pen for a while
 * mid-note, so this is generous; a clock discontinuity is many orders of magnitude above it.
 */
const MAX_PLAUSIBLE_STEP_MS = 60_000;

/** Substituted for a step that cannot be real — about how long lifting and repositioning a pen takes. */
const NOMINAL_PEN_LIFT_MS = 150;

export function normalizeStrokeTimings(strokes: Stroke[]): Stroke[] {
  let previousRaw: number | null = null;
  let elapsed = 0;

  return strokes.map(stroke =>
    stroke.map((point): StrokePoint => {
      if (previousRaw !== null) {
        const step = point.t - previousRaw;
        // Backwards means two clocks; implausibly large means the same. Neither can be measured, so
        // both collapse to a nominal pen lift — in practice this only ever fires at the stroke
        // boundary where one capture session ends and the next begins.
        elapsed += step < 0 || step > MAX_PLAUSIBLE_STEP_MS ? NOMINAL_PEN_LIFT_MS : step;
      }
      previousRaw = point.t;

      return { x: point.x, y: point.y, t: elapsed };
    }),
  );
}
