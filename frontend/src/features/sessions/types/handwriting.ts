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
   * Capture time in milliseconds on the epoch clock (`performance.timeOrigin + event.timeStamp`).
   * The recognizer reads writing speed and pen lifts from the spacing between points, so timing is
   * captured, not dropped.
   *
   * Absolute rather than page-relative because strokes are persisted and appended to across page
   * reloads, and each reload restarts the page clock. Payloads written before this was fixed still
   * hold page-relative stamps, so the two bases can coexist inside one note — `normalizeStrokeTimings`
   * reconciles them on the way to the recognizer.
   */
  t: number;
}

/** The ordered points of a single pen-down → pen-up gesture. */
export type Stroke = StrokePoint[];

/** How a recognized line participates in the note's layout. Mirrors the API's RecognizedLineKind. */
export type RecognizedLineKind = 'text' | 'listItem';

/**
 * One visual line of handwriting as the recognizer segmented it, with the layout annotations the
 * reflow rule reads. Mirrors the API's `RecognizedLine`.
 */
export interface RecognizedLine {
  text: string;
  /**
   * Whether the writer deliberately opened this line. The recognizer reports an explicit break when
   * the writer returned to the next line although the word still fitted at the end of the previous
   * one; a line that only wrapped for lack of horizontal room is implicit, and may be folded back
   * into its predecessor.
   */
  isExplicitBreak: boolean;
  kind: RecognizedLineKind;
  /** Bullet flavour of a list line ("bullet", "letter", "number", "check"). Null on prose lines. */
  bulletKind?: string | null;
  /** Top edge of the line's ink in the provider's millimetre space. Null when unavailable. */
  top?: number | null;
  /** Bottom edge of the line's ink. Null when unavailable. */
  bottom?: number | null;
}

/** A transcription: the flat text, plus the same content split into annotated visual lines. */
export interface RecognitionResult {
  /** Recognized text, lines separated by newlines. Empty when nothing was legible. */
  text: string;
  /** The same transcription as annotated lines. Empty only when `text` is empty. */
  lines: RecognizedLine[];
}
