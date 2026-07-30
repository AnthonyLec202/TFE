import { apiClient, HttpError, NetworkError } from '../../../services/apiClient';
import type { Stroke } from '../types/handwriting';

interface RecognizeHandwritingResponse {
  text: string;
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
): Promise<string> {
  if (strokes.length === 0) return '';

  try {
    const response = await apiClient.post<RecognizeHandwritingResponse>(
      '/api/handwriting/recognize',
      { strokes, width, height },
    );
    // A missing field would otherwise surface far downstream as `undefined.trim()`.
    return typeof response?.text === 'string' ? response.text : '';
  } catch (error) {
    throw new HandwritingRecognitionError(toClinicianMessage(error), { cause: error });
  }
}

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
