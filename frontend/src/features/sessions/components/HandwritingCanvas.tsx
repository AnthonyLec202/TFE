import { useEffect, useRef } from 'react';

interface StrokePoint {
  x: number;
  y: number;
  t: number;
}

interface HandwritingCanvasProps {
  strokes: any[];
  onStrokesUpdate: (newStrokes: any[]) => void;
}

const CANVAS_HEIGHT = 220;
const STROKE_COLOR = '#1e293b';
const STROKE_WIDTH = 2;

export function HandwritingCanvas({ strokes, onStrokesUpdate }: HandwritingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentPointsRef = useRef<StrokePoint[]>([]);
  const isDrawingRef = useRef(false);

  // Keep canvas pixel dimensions in sync with rendered CSS width.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sync = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = CANVAS_HEIGHT;
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // Clear the canvas visually when strokes are externally reset (e.g. after conversion).
  useEffect(() => {
    if (strokes.length === 0) {
      const canvas = canvasRef.current;
      if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [strokes.length]);

  function getCtx(): CanvasRenderingContext2D | null {
    return canvasRef.current?.getContext('2d') ?? null;
  }

  function getCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>): StrokePoint {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, t: e.timeStamp };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>): void {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    currentPointsRef.current = [];

    const { x, y } = getCanvasPoint(e);
    currentPointsRef.current.push({ x, y, t: e.timeStamp });

    const ctx = getCtx();
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (!isDrawingRef.current) return;
    const { x, y } = getCanvasPoint(e);
    currentPointsRef.current.push({ x, y, t: e.timeStamp });

    const ctx = getCtx();
    if (ctx) {
      ctx.strokeStyle = STROKE_COLOR;
      ctx.lineWidth = STROKE_WIDTH;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const { x, y } = getCanvasPoint(e);
    currentPointsRef.current.push({ x, y, t: e.timeStamp });

    if (currentPointsRef.current.length > 0) {
      onStrokesUpdate([...strokes, currentPointsRef.current]);
    }
    currentPointsRef.current = [];
  }

  return (
    <div className="mx-8 my-6 flex flex-col gap-2">
      <p className="text-xs text-slate-400">
        Draw on the canvas — click <strong>Convert to Text</strong> to send strokes for recognition.
      </p>
      <canvas
        ref={canvasRef}
        height={CANVAS_HEIGHT}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ touchAction: 'none', height: CANVAS_HEIGHT }}
        className="w-full rounded-lg border border-slate-200 bg-white cursor-crosshair"
      />
      {strokes.length > 0 && (
        <p className="text-xs text-slate-400">
          {strokes.length} stroke{strokes.length !== 1 ? 's' : ''} captured — ready to convert.
        </p>
      )}
    </div>
  );
}
