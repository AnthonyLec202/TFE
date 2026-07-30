/**
 * Serialization of not-yet-converted strokes held on a note.
 *
 * The payload carries the dimensions of the surface the strokes were captured on, not just the
 * strokes. The recognizer needs the writing area to segment lines correctly, and a retry performed
 * later — from a list, on a note that is not open — has no canvas to ask.
 *
 * Pure helpers: no React, no I/O.
 */
import type { Stroke } from '../types/handwriting';

export interface PendingStrokes {
  strokes: Stroke[];
  /** Pixel width of the capture surface. */
  width: number;
  /** Pixel height of the capture surface at the time of capture (the canvas grows while writing). */
  height: number;
}

export const EMPTY_PENDING_STROKES: PendingStrokes = { strokes: [], width: 0, height: 0 };

/** Floor applied to a surface derived from a legacy payload, so a stray tiny scribble still gets a sane area. */
const MIN_DERIVED_DIMENSION = 400;
/** Breathing room added around the ink when deriving a surface, approximating the original margins. */
const DERIVED_MARGIN = 40;

export function serializePendingStrokes(pending: PendingStrokes): string {
  return JSON.stringify(pending);
}

/**
 * Reads a stored payload back, tolerating every shape it may have on disk.
 *
 * Three cases are handled, because rows written by earlier builds are still in the wild:
 *  - the current object form, `{ strokes, width, height }`;
 *  - the legacy bare array of strokes, whose surface is reconstructed from the ink's bounding box —
 *    an approximation, but a far better one than the fixed 2000×2000 constant it replaces;
 *  - anything unparseable or malformed, which yields an empty result rather than throwing. Strokes
 *    are read on the dashboard and in the workspace, and one corrupt payload must not take a page
 *    down.
 */
export function parsePendingStrokes(raw: string | undefined | null): PendingStrokes {
  if (!raw) return EMPTY_PENDING_STROKES;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_PENDING_STROKES;
  }

  // Legacy: a bare array of strokes, with no recorded surface.
  if (Array.isArray(parsed)) {
    const strokes = sanitizeStrokes(parsed);
    return { strokes, ...deriveSurface(strokes) };
  }

  if (typeof parsed !== 'object' || parsed === null) return EMPTY_PENDING_STROKES;

  const candidate = parsed as Partial<PendingStrokes>;
  const strokes = sanitizeStrokes(candidate.strokes);
  if (strokes.length === 0) return EMPTY_PENDING_STROKES;

  // A recorded surface that is absent or nonsensical falls back to the derived one.
  const hasUsableSurface =
    typeof candidate.width === 'number' && candidate.width > 0 &&
    typeof candidate.height === 'number' && candidate.height > 0;

  return hasUsableSurface
    ? { strokes, width: Math.round(candidate.width!), height: Math.round(candidate.height!) }
    : { strokes, ...deriveSurface(strokes) };
}

/** Total number of sampled points across every stroke — the payload-size signal the API bounds. */
export function countPoints(strokes: Stroke[]): number {
  return strokes.reduce((total, stroke) => total + stroke.length, 0);
}

/** Keeps only well-formed strokes and points, so a malformed payload can never reach the recognizer. */
function sanitizeStrokes(value: unknown): Stroke[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(Array.isArray)
    .map(stroke =>
      stroke.filter(
        (point): point is { x: number; y: number; t: number } =>
          typeof point === 'object' && point !== null &&
          Number.isFinite((point as { x?: unknown }).x) &&
          Number.isFinite((point as { y?: unknown }).y) &&
          Number.isFinite((point as { t?: unknown }).t),
      ),
    )
    .filter(stroke => stroke.length > 0);
}

/** Reconstructs a plausible writing area from the ink's extent, for payloads that recorded none. */
function deriveSurface(strokes: Stroke[]): { width: number; height: number } {
  let maxX = 0;
  let maxY = 0;
  for (const stroke of strokes) {
    for (const point of stroke) {
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }
  }
  return {
    width: Math.max(MIN_DERIVED_DIMENSION, Math.ceil(maxX) + DERIVED_MARGIN),
    height: Math.max(MIN_DERIVED_DIMENSION, Math.ceil(maxY) + DERIVED_MARGIN),
  };
}
