/**
 * Stroke capture types for the stylus note-taking surface.
 *
 * Replaces the former ambient `handwriting.d.ts`, which declared the experimental Web Handwriting
 * Recognition API (`navigator.createHandwritingRecognizer`) from an approach that was abandoned in
 * favour of server-proxied recognition — nothing referenced it.
 */

/** One sampled pointer position, in canvas pixel coordinates. */
export interface StrokePoint {
  x: number;
  y: number;
  /**
   * Milliseconds since the page's time origin (`PointerEvent.timeStamp`). The recognizer reads
   * writing speed and pen lifts from the spacing between points, so timing is captured, not dropped.
   */
  t: number;
}

/** The ordered points of a single pen-down → pen-up gesture. */
export type Stroke = StrokePoint[];
