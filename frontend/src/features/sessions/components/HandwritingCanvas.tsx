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
// Ceiling on the growth. The bitmap is allocated at this height times the device pixel ratio, and
// browsers cap both a canvas dimension and its total area — past the cap the canvas stops painting
// entirely rather than failing loudly. A note this long is meant to be converted, not extended.
const MAX_CANVAS_HEIGHT = 12000;

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
  // Scale factor between the CSS-pixel coordinate space and the device-pixel bitmap, refreshed on
  // every resize. Held in a ref because `redraw` needs it outside the render cycle.
  const pixelRatioRef = useRef(1);
  const [canvasHeight, setCanvasHeight] = useState(INITIAL_CANVAS_HEIGHT);
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
    if (strokes.length === 0) setCanvasHeight(INITIAL_CANVAS_HEIGHT);
  }

  // Repaint when the persisted stroke set changes (new stroke committed, undone, or cleared
  // after conversion). The strokes ref backs `redraw` so the ResizeObserver always
  // sees the latest set without re-subscribing.
  useEffect(() => {
    strokesRef.current = strokes;
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
      t: timeStamp,
    };
  }

  // Extend the writing surface when a point lands near the current bottom edge.
  function growIfNearBottom(y: number): void {
    setCanvasHeight(prev => {
      if (y <= prev - GROWTH_THRESHOLD || prev >= MAX_CANVAS_HEIGHT) return prev;
      return Math.min(MAX_CANVAS_HEIGHT, Math.ceil(y) + GROWTH_INCREMENT);
    });
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
    if (points.length > 0) onStrokesUpdate([...strokes, points]);
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
