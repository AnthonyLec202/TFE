import { useEffect, useRef, useState } from 'react';
import type { Stroke, StrokePoint } from '../types/handwriting';

interface HandwritingCanvasProps {
  strokes: Stroke[];
  onStrokesUpdate: (newStrokes: Stroke[]) => void;
  /**
   * Reports the CSS-pixel dimensions of the writing surface whenever they change. The recognizer needs
   * the real capture area: strokes falling outside the area it is told about are recognized poorly,
   * and this canvas grows without bound as the clinician writes.
   */
  onSurfaceResize: (width: number, height: number) => void;
}

const STROKE_COLOR = '#1e293b';
const STROKE_WIDTH = 2;

// The canvas starts tall and grows downward as the writer approaches its bottom edge,
// giving an effectively infinite vertical writing surface inside the scroll container.
const INITIAL_CANVAS_HEIGHT = 900;
const GROWTH_THRESHOLD = 250; // px from the bottom that triggers a height increase
const GROWTH_INCREMENT = 600; // px appended each time the writer nears the bottom

// Ceiling on the growth, derived rather than fixed — see computeMaxCanvasHeight.
//
// Browsers cap a canvas by total bitmap area as well as by either dimension, and past the cap the
// canvas stops painting entirely rather than failing loudly. The bitmap is allocated at the CSS size
// times the device pixel ratio, so a constant expressed in CSS pixels silently means four times as
// much bitmap on a 200 %-scaled tablet and nine times on a 300 % one: the 12000 this replaces
// allocated a 36000 px-tall bitmap at DPR 3, well past every engine's per-dimension ceiling.
/** WebKit on iPadOS is the tightest of the three engines, at roughly 16.7 M device pixels. */
const MAX_BITMAP_AREA = 16_000_000;
/** Firefox's per-dimension ceiling, the lowest of the three. */
const MAX_BITMAP_DIMENSION = 32767;
/**
 * Floor on the derived ceiling: a surface too short to write on is worse than a large bitmap.
 *
 * On a very wide surface the floor wins over the area budget, which is intentional — a width that
 * pushes the budget below this only occurs on a desktop display, and the desktop engines' real
 * ceiling is an order of magnitude above the WebKit figure the budget is calibrated on.
 */
const MIN_GROWTH_CEILING = 2000;

/**
 * Largest CSS height the surface may grow to before the bitmap it implies breaks a browser limit.
 *
 * The bitmap measures `cssWidth × ratio` by `cssHeight × ratio` device pixels, so the area budget
 * bounds the CSS height at `budget / (cssWidth × ratio²)`. On a 930 px-wide fullscreen surface at
 * DPR 2 — a Surface Pro held in portrait — that is about 4300 CSS pixels, on the order of a hundred
 * handwritten lines. Widening the surface lowers the ceiling, which is exactly the trade the area
 * budget expresses.
 */
function computeMaxCanvasHeight(cssWidth: number, ratio: number): number {
  const areaBound = MAX_BITMAP_AREA / (cssWidth * ratio * ratio);
  const dimensionBound = MAX_BITMAP_DIMENSION / ratio;
  return Math.max(MIN_GROWTH_CEILING, Math.floor(Math.min(areaBound, dimensionBound)));
}

/**
 * `PointerEvent.buttons` for "the primary tip is in contact and nothing else is pressed".
 *
 * Compared exactly rather than masked: the eraser end of a Surface Pen reports 32 and a barrel-button
 * contact reports 3, and neither should leave ink where the writer expects an erase or a right-click.
 */
const PRIMARY_CONTACT_ONLY = 1;

export function HandwritingCanvas({ strokes, onStrokesUpdate, onSurfaceResize }: HandwritingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentPointsRef = useRef<StrokePoint[]>([]);
  const isDrawingRef = useRef(false);
  const strokesRef = useRef(strokes);
  // Raised when this component's own pen-up hands a stroke up to the parent, so the repaint effect
  // below can tell that commit apart from a stroke set arriving from anywhere else.
  const hasJustCommittedRef = useRef(false);
  // Scale factor between the CSS-pixel coordinate space and the device-pixel bitmap, refreshed on
  // every resize. Held in a ref because `redraw` needs it outside the render cycle.
  const pixelRatioRef = useRef(1);
  const [canvasHeight, setCanvasHeight] = useState(INITIAL_CANVAS_HEIGHT);
  // Growth ceiling for the current width and pixel ratio, recomputed on every resize. A ref rather
  // than state: it is read from a pointer handler, and writing state from the ResizeObserver's
  // synchronous first call would add a render pass for a value no render depends on.
  const maxCanvasHeightRef = useRef(MIN_GROWTH_CEILING);
  // Whether the surface has refused to grow any further. Surfaced in the hint below, because a
  // writer who reaches the bottom and finds the sheet no longer extending has no other way to know
  // that converting is what frees the space.
  const [hasReachedMaxHeight, setHasReachedMaxHeight] = useState(false);
  // Whether a pen is currently over the surface, which decides `touch-action` — see the JSX below.
  const [isPenPresent, setIsPenPresent] = useState(false);
  // Ref-stabilised so the ResizeObserver effect below never re-subscribes on a parent re-render.
  // Assigned in an effect rather than during render: a ref write during render is not a legal
  // side effect, and the observer only reads it from a callback that runs after commit anyway.
  const onSurfaceResizeRef = useRef(onSurfaceResize);
  useEffect(() => {
    onSurfaceResizeRef.current = onSurfaceResize;
  });

  // Repaint every committed stroke (plus the in-progress one) onto the bitmap.
  // Called after any bitmap resize, which would otherwise wipe previously drawn ink.
  function redraw(): void {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // The bitmap is sized in device pixels while everything drawn into it is expressed in CSS
    // pixels, so the transform is dropped to clear the raw bitmap and restored immediately after.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(pixelRatioRef.current, 0, 0, pixelRatioRef.current, 0, 0);
    applyStrokeStyle(ctx);

    const drawStroke = (points: StrokePoint[]) => {
      if (points.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
    };

    for (const stroke of strokesRef.current) {
      // Guarded: strokes may come from a persisted payload written by an earlier build.
      if (Array.isArray(stroke)) drawStroke(stroke);
    }
    if (isDrawingRef.current) drawStroke(currentPointsRef.current);
  }

  // Keep the bitmap pixel dimensions in sync with the rendered CSS box, repainting
  // the ink afterwards. Re-runs whenever the CSS height changes (canvas growth).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sync = () => {
      const cssWidth = canvas.clientWidth;
      const cssHeight = canvas.clientHeight;
      // Measured before the surface is actually displayed: a zero-sized bitmap would report a
      // meaningless capture area and drop the repaint. The observer fires again once it has a size.
      if (cssWidth === 0 || cssHeight === 0) return;

      // The bitmap is allocated in device pixels and the context scaled by the same factor, so ink
      // stays sharp on the 200 %-scaled displays these tablets ship with. Every coordinate handled by
      // this component — and every stored stroke — stays in CSS pixels regardless.
      const ratio = window.devicePixelRatio || 1;
      pixelRatioRef.current = ratio;
      canvas.width = Math.round(cssWidth * ratio);
      canvas.height = Math.round(cssHeight * ratio);

      // Recomputed here rather than once at mount: entering fullscreen, rotating the tablet or
      // moving the window to a display of another density all change the width or the ratio, and
      // each of them moves the ceiling.
      //
      // A surface that widens lowers its ceiling below the height already reached — rotating to
      // landscape mid-note, for instance. The height is deliberately left alone in that case: the
      // ceiling governs further growth, and shrinking the canvas would drop every stroke below the
      // new bottom out of the painted area.
      maxCanvasHeightRef.current = computeMaxCanvasHeight(cssWidth, ratio);

      // Stroke coordinates are CSS pixels, so the recognizer is told the CSS-pixel surface — not the
      // bitmap, which is twice as large on a high-density display — including after each growth step.
      onSurfaceResizeRef.current(cssWidth, cssHeight);
      redraw();
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // Nothing left to show — after a conversion, an undo of the last stroke, or a clear — so the
  // surface returns to its initial height rather than keeping a multi-thousand-pixel bitmap
  // allocated, and scrolled past, for the rest of the session. Adjusted during render rather than in
  // an effect: React re-runs the render immediately with the corrected height, so the tall canvas is
  // never committed to the DOM and never painted.
  const [renderedStrokeCount, setRenderedStrokeCount] = useState(strokes.length);
  if (renderedStrokeCount !== strokes.length) {
    setRenderedStrokeCount(strokes.length);
    if (strokes.length === 0) {
      setCanvasHeight(INITIAL_CANVAS_HEIGHT);
      setHasReachedMaxHeight(false);
    }
  }

  // Repaint when the stroke set changes — undone, cleared after conversion, or loaded from a
  // persisted payload. The strokes ref backs `redraw` so the ResizeObserver always sees the latest
  // set without re-subscribing.
  //
  // A stroke this component just committed is the one case that needs no repaint: its segments were
  // inked as the pen moved, so the bitmap already holds it. Repainting anyway meant redrawing every
  // stroke in the note on every pen-up — work that grows with the length of the note, on a surface
  // whose bitmap is now several thousand pixels tall.
  useEffect(() => {
    const previous = strokesRef.current;
    strokesRef.current = strokes;

    // Gated on the flag as well as the shape: going from no strokes to a loaded payload also looks
    // like an append, and that ink has never been painted.
    const isOwnCommit =
      hasJustCommittedRef.current &&
      strokes.length === previous.length + 1 &&
      previous.every((stroke, index) => stroke === strokes[index]);
    hasJustCommittedRef.current = false;

    if (isOwnCommit) return;
    redraw();
  }, [strokes]);

  function getCanvasPoint(clientX: number, clientY: number, timeStamp: number): StrokePoint {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // getBoundingClientRect() measures the border box while the bitmap covers the content box, so the
    // border has to come off — otherwise every point lands one pixel below and right of the tip.
    return {
      x: clientX - rect.left - canvas.clientLeft,
      y: clientY - rect.top - canvas.clientTop,
      // Shifted onto the epoch clock rather than stored as the page-relative value the event carries.
      // Strokes outlive the page: they are persisted and written back to across reloads, and
      // `performance.timeOrigin` restarts with each one — so page-relative stamps from two sessions
      // of the same note are timed against different clocks, and the recognizer reads the spacing
      // between them as writing speed and pen lifts.
      t: performance.timeOrigin + timeStamp,
    };
  }

  // Extend the writing surface when a point lands near the current bottom edge.
  //
  // Reads `canvasHeight` directly rather than through an updater: one pointermove carries several
  // coalesced samples, and every call in that batch should measure against the height the surface had
  // when the batch began. The deepest sample then wins, which is the intended outcome.
  function growIfNearBottom(y: number): void {
    if (y <= canvasHeight - GROWTH_THRESHOLD) return;

    const maxHeight = maxCanvasHeightRef.current;
    if (canvasHeight >= maxHeight) {
      if (!hasReachedMaxHeight) setHasReachedMaxHeight(true);
      return;
    }

    setCanvasHeight(Math.min(maxHeight, Math.ceil(y) + GROWTH_INCREMENT));
  }

  // One segment, one path. The previous implementation kept a single path open for the whole stroke
  // and re-stroked it on every move, which darkened the antialiasing as the stroke grew and broke
  // silently whenever a mid-stroke resize reset the context state.
  function drawSegment(ctx: CanvasRenderingContext2D, from: StrokePoint, to: StrokePoint): void {
    applyStrokeStyle(ctx);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  // Appends a sampled position to the stroke in progress and inks the segment leading to it.
  function extendStroke(clientX: number, clientY: number, timeStamp: number): void {
    const point = getCanvasPoint(clientX, clientY, timeStamp);
    const previous = currentPointsRef.current[currentPointsRef.current.length - 1];
    currentPointsRef.current.push(point);
    growIfNearBottom(point.y);

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && previous) drawSegment(ctx, previous, point);
  }

  /**
   * Closes the stroke in progress and hands it to the parent.
   *
   * Shared by pen-up, pointer cancellation and capture loss, and idempotent so the implicit capture
   * release that follows a normal pen-up is a no-op. A stroke the browser takes away mid-gesture is
   * ink the clinician actually drew, so it is committed rather than discarded — and, more
   * importantly, the drawing flag is cleared: a pen keeps emitting move events while hovering above
   * the glass, so a flag left set would trail ink under a pen that is no longer touching.
   */
  function finishStroke(): void {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const points = currentPointsRef.current;
    currentPointsRef.current = [];
    if (points.length === 0) return;

    // Raised before handing the stroke up: the parent may apply it synchronously, and the repaint
    // effect must already know this ink is on the bitmap.
    hasJustCommittedRef.current = true;
    onStrokesUpdate([...strokes, points]);
  }

  // `touch-action` is switched on hover rather than on contact, because the browser decides at
  // pointer-down whether a gesture belongs to the scroller — by the time the tip lands it is too
  // late. See the JSX for why the pen needs `none` at all.
  function handlePointerEnter(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (e.pointerType === 'pen') setIsPenPresent(true);
  }

  function handlePointerLeave(e: React.PointerEvent<HTMLCanvasElement>): void {
    // Never while writing: with the pointer captured, a stroke leaving the element must not hand the
    // surface back to the scroller mid-word.
    if (e.pointerType === 'pen' && !isDrawingRef.current) setIsPenPresent(false);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>): void {
    // Finger touches are reserved for scrolling the note. Only the pen and the mouse capture ink.
    if (e.pointerType === 'touch') return;
    // Primary tip only — the eraser end and the barrel button are deliberately inert rather than
    // silently inking.
    if (e.button !== 0 || e.buttons !== PRIMARY_CONTACT_ONLY) return;
    // Belt and braces: if a hover event was missed, at least every subsequent stroke is protected.
    if (e.pointerType === 'pen') setIsPenPresent(true);

    // A stroke left open by a cancellation we were never told about must not merge into this one.
    finishStroke();

    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    currentPointsRef.current = [getCanvasPoint(e.clientX, e.clientY, e.timeStamp)];
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (!isDrawingRef.current || e.pointerType === 'touch') return;

    // The tip is no longer in contact, yet we still believe we are drawing: the pen-up was lost to a
    // cancellation. Close the stroke here instead of following the pen around while it hovers.
    if (e.buttons !== PRIMARY_CONTACT_ONLY) {
      finishStroke();
      return;
    }

    e.preventDefault();

    // Chromium delivers at most one pointermove per frame while a Surface Pen samples several times
    // faster; the positions it merged away are the ones that make a curve a curve, and their spacing
    // is the temporal signal the recognizer reads. Falls back to the event itself where the API is
    // unavailable or returned nothing.
    const coalesced = e.nativeEvent.getCoalescedEvents?.();
    const samples = coalesced && coalesced.length > 0 ? coalesced : [e.nativeEvent];
    for (const sample of samples) {
      extendStroke(sample.clientX, sample.clientY, sample.timeStamp);
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (!isDrawingRef.current || e.pointerType === 'touch') return;
    extendStroke(e.clientX, e.clientY, e.timeStamp);
    finishStroke();
  }

  return (
    <div className="mx-3 sm:mx-8 my-6 flex flex-col gap-2">
      <p className="text-xs text-taupe-400">
        Écrivez avec votre stylet — faites défiler avec le doigt ou la molette. Cliquez sur{' '}
        <strong>Convertir en texte</strong> pour envoyer les tracés à la reconnaissance.
        {strokes.length > 0 && (
          <> {' · '}{strokes.length} tracé{strokes.length !== 1 ? 's' : ''} capturé{strokes.length !== 1 ? 's' : ''}.</>
        )}
      </p>
      {/* The surface has stopped extending. Without this the writer just finds the sheet no longer
          growing under the pen, with nothing to explain why or what to do about it. */}
      {hasReachedMaxHeight && (
        <p role="status" aria-live="polite" className="text-xs text-amber-700">
          La feuille a atteint sa taille maximale. Convertissez vos tracés en texte pour repartir sur
          une feuille vierge.
        </p>
      )}
      <canvas
        ref={canvasRef}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        // A cancelled pointer never delivers a pen-up. Both are handled, and both are needed: the
        // scroller claiming the gesture, a palm landing, or the pen leaving the digitizer's range all
        // end a stroke this way.
        onPointerCancel={finishStroke}
        onLostPointerCapture={finishStroke}
        // Windows turns a barrel-button click, and a press-and-hold, into a context menu — which pops
        // over the note and cancels the stroke underneath it.
        onContextMenu={e => e.preventDefault()}
        // `touch-action` governs the pen as well as the finger under Chromium on Windows: with
        // `pan-y`, any downstroke long enough to look like a pan — the hampe of a "l" is more than
        // enough — is handed to the scroll container, which cancels the pointer and turns the stroke
        // into a scroll. So the surface locks to `none` while a pen is over it, and returns to
        // `pan-y` when the pen leaves, which is also what keeps a resting palm from scrolling the
        // page out from under the writer.
        style={{ touchAction: isPenPresent ? 'none' : 'pan-y', height: canvasHeight }}
        className="w-full rounded-lg border border-sand-200 bg-white cursor-crosshair"
      />
    </div>
  );
}

function applyStrokeStyle(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = STROKE_COLOR;
  ctx.lineWidth = STROKE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}
