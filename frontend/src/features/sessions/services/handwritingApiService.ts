import { apiClient, HttpError, NetworkError } from '../../../services/apiClient';
import type { RecognitionResult, RecognizedLine, Stroke } from '../types/handwriting';
import { normalizeStrokeTimings } from '../utils/strokeTimings';

interface RecognizeHandwritingResponse {
  text: string;
  /** Absent when talking to an API build that predates per-line layout annotation. */
  lines?: RecognizedLine[];
}

/**
 * Thrown when recognition could not produce text. `message` is written for the clinician: the UI
 * displays it verbatim, because a silent failure on this feature is indistinguishable from an inert
 * button.
 */
export class HandwritingRecognitionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'HandwritingRecognitionError';
  }
}

/**
 * Sends captured strokes to the API for transcription.
 *
 * Recognition is proxied by the backend rather than called from the browser: the provider is
 * authenticated with an application key AND an HMAC signing key, and signing client-side would mean
 * shipping both in the JavaScript bundle, where anyone could extract them and spend the quota.
 *
 * @param strokes  Strokes in capture order, in canvas pixel coordinates.
 * @param width    Width of the capture surface, forwarded as the recognizer's writing-area size.
 * @param height   Height of the capture surface at submission time (the canvas grows while writing).
 */
export async function recognizeBatch(
  strokes: Stroke[],
  width: number,
  height: number,
): Promise<RecognitionResult> {
  if (strokes.length === 0) return EMPTY_RECOGNITION;

  try {
    const response = await apiClient.post<RecognizeHandwritingResponse>(
      '/api/handwriting/recognize',
      // Timestamps are reconciled at this boundary rather than at capture: a batch persisted across
      // a page reload can carry two different clocks, and this is the last point where the whole
      // batch is visible at once. See normalizeStrokeTimings.
      { strokes: normalizeStrokeTimings(strokes), width, height },
    );
    // Both fields are normalised here rather than downstream: a missing one would otherwise surface
    // far away as `undefined.trim()`, and an absent `lines` is the expected shape when this client
    // runs against an API build that predates the layout annotation.
    return {
      text: typeof response?.text === 'string' ? response.text : '',
      lines: Array.isArray(response?.lines) ? response.lines : [],
    };
  } catch (error) {
    throw new HandwritingRecognitionError(toClinicianMessage(error), { cause: error });
  }
}

const EMPTY_RECOGNITION: RecognitionResult = { text: '', lines: [] };

function toClinicianMessage(error: unknown): string {
  if (error instanceof NetworkError) {
    return 'La reconnaissance nécessite une connexion. Vos tracés sont conservés : réessayez une fois reconnecté.';
  }

  if (error instanceof HttpError) {
    switch (error.status) {
      case 503:
        return "La reconnaissance d'écriture n'est pas configurée sur le serveur. Contactez l'administrateur.";
      case 502:
        return "Le service de reconnaissance est momentanément indisponible. Vos tracés sont conservés : réessayez dans un instant.";
      case 429:
        return 'Trop de conversions successives. Patientez quelques minutes avant de réessayer.';
      case 400:
        return 'Le tracé est trop volumineux pour être reconnu en une fois. Convertissez-le en plusieurs parties.';
      default:
        return 'La reconnaissance a échoué. Vos tracés sont conservés : vous pouvez réessayer.';
    }
  }

  return 'La reconnaissance a échoué. Vos tracés sont conservés : vous pouvez réessayer.';
}
