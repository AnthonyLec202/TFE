using TFE.Api.DTOs.Handwriting;

namespace TFE.Api.Interfaces.IServices.Handwriting;

/// <summary>
/// Transcribes pen strokes captured on a client into text.
///
/// Exists as a server-side service — rather than a direct browser call — because the recognition
/// provider is authenticated with a metered application key and an HMAC signing key. Signing in the
/// browser would require shipping both in the JavaScript bundle, where anyone could extract them and
/// spend the quota. Here they stay in server configuration.
/// </summary>
public interface IHandwritingRecognitionService
{
    /// <summary>
    /// Recognizes the submitted strokes.
    /// </summary>
    /// <param name="request">Strokes in capture order, with the dimensions of the capture surface.</param>
    /// <param name="cancellationToken">Token to cancel the upstream recognition call.</param>
    /// <returns>The transcription; empty text when nothing legible was found.</returns>
    /// <exception cref="InvalidOperationException">The recognition provider is not configured.</exception>
    /// <exception cref="HttpRequestException">The provider rejected the request or was unreachable.</exception>
    Task<RecognizeHandwritingResponse> RecognizeAsync(
        RecognizeHandwritingRequest request,
        CancellationToken cancellationToken = default);
}
