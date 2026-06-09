interface HandwritingPoint {
  x: number;
  y: number;
  t: number;
}

// Constructable class — instances are built with `new HandwritingStroke()`.
declare class HandwritingStroke {
  addPoint(point: HandwritingPoint): void;
}

interface HandwritingPrediction {
  text: string;
}

interface HandwritingDrawing {
  addStroke(stroke: HandwritingStroke): void;
  getPrediction(): Promise<HandwritingPrediction[]>;
  clear(): void;
}

interface HandwritingRecognizerConstraints {
  languages: string[];
}

interface HandwritingRecognizer {
  startDrawing(): HandwritingDrawing;
  finish(): void;
}

interface Navigator {
  createHandwritingRecognizer(
    constraints: HandwritingRecognizerConstraints,
  ): Promise<HandwritingRecognizer>;
}
