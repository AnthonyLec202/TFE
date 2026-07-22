import { useEffect, useRef, useState } from 'react';

interface StrokePoint {
  x: number;
  y: number;
  t: number;
}

interface HandwritingCanvasProps {
  strokes: any[];
  onStrokesUpdate: (newStrokes: any[]) => void;
}

const STROKE_COLOR = '#1e293b';
const STROKE_WIDTH = 2;

// The canvas starts tall and grows downward as the writer approaches its bottom edge,
// giving an effectively infinite vertical writing surface inside the scroll container.
const INITIAL_CANVAS_HEIGHT = 900;
const GROWTH_THRESHOLD = 250; // px from the bottom that triggers a height increase
const GROWTH_INCREMENT = 600; // px appended each time the writer nears the bottom

export function HandwritingCanvas({ strokes, onStrokesUpdate }: HandwritingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentPointsRef = useRef<StrokePoint[]>([]);
  const isDrawingRef = useRef(false);
  const strokesRef = useRef(strokes);
  const [canvasHeight, setCanvasHeight] = useState(INITIAL_CANVAS_HEIGHT);

  // Repaint every committed stroke (plus the in-progress one) onto the bitmap.
  // Called after any bitmap resize, which would otherwise wipe previously drawn ink.
  function redraw(): void {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = STROKE_COLOR;
    ctx.lineWidth = STROKE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const drawStroke = (points: StrokePoint[]) => {
      if (points.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
    };

    for (const stroke of strokesRef.current) {
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
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      redraw();
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // Repaint when the persisted stroke set changes (new stroke committed, or cleared
  // after conversion). The strokes ref backs `redraw` so the ResizeObserver always
  // sees the latest set without re-subscribing.
  useEffect(() => {
    strokesRef.current = strokes;
    redraw();
  }, [strokes]);

  function getCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>): StrokePoint {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, t: e.timeStamp };
  }

  // Extend the writing surface when a point lands near the current bottom edge.
  function growIfNearBottom(y: number): void {
    setCanvasHeight(prev => (y > prev - GROWTH_THRESHOLD ? Math.ceil(y) + GROWTH_INCREMENT : prev));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>): void {
    // Finger touches are reserved for native vertical scrolling (touch-action: pan-y).
    // Only the pen and the mouse capture ink.
    if (e.pointerType === 'touch') return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    currentPointsRef.current = [];

    const point = getCanvasPoint(e);
    currentPointsRef.current.push(point);

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = STROKE_COLOR;
      ctx.lineWidth = STROKE_WIDTH;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (!isDrawingRef.current || e.pointerType === 'touch') return;
    e.preventDefault();

    const point = getCanvasPoint(e);
    currentPointsRef.current.push(point);
    growIfNearBottom(point.y);

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (!isDrawingRef.current || e.pointerType === 'touch') return;
    isDrawingRef.current = false;

    const point = getCanvasPoint(e);
    currentPointsRef.current.push(point);
    growIfNearBottom(point.y);

    if (currentPointsRef.current.length > 0) {
      onStrokesUpdate([...strokes, currentPointsRef.current]);
    }
    currentPointsRef.current = [];
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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ touchAction: 'pan-y', height: canvasHeight }}
        className="w-full rounded-lg border border-sand-200 bg-white cursor-crosshair"
      />
    </div>
  );
}
