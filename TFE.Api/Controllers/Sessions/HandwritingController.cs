using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TFE.Api.DTOs.Handwriting;
using TFE.Api.Interfaces.IServices.Handwriting;

namespace TFE.Api.Controllers.Sessions;

/// <summary>
/// Server-side proxy to the handwriting recognition provider. The provider's application and HMAC
/// keys stay in this API's configuration and never reach the browser.
/// </summary>
[ApiController]
[Route("api/handwriting")]
[Authorize]
public class HandwritingController : ControllerBase
{
    private readonly IHandwritingRecognitionService _handwritingRecognitionService;

    public HandwritingController(IHandwritingRecognitionService handwritingRecognitionService)
    {
        _handwritingRecognitionService = handwritingRecognitionService;
    }

    /// <summary>
    /// Transcribes captured strokes. Rate-limited per user: every call is billed against a metered
    /// third-party quota, which the client can no longer be trusted to bound now that the credentials
    /// live here.
    /// </summary>
    [HttpPost("recognize")]
    [EnableRateLimiting("HandwritingPolicy")]
    public async Task<IActionResult> Recognize(
        [FromBody] RecognizeHandwritingRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await _handwritingRecognitionService.RecognizeAsync(request, cancellationToken));
        }
        catch (InvalidOperationException)
        {
            // Provider keys absent: an operator problem, not a client one. 503 tells the frontend the
            // feature is unavailable in this environment rather than that the request was malformed.
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                message = "La reconnaissance d'écriture n'est pas configurée sur ce serveur.",
            });
        }
        catch (ArgumentOutOfRangeException)
        {
            return BadRequest(new { message = "Le tracé soumis est trop volumineux pour être reconnu." });
        }
        catch (HttpRequestException)
        {
            // The provider is down or rejected us. Deliberately opaque: its body may disclose account
            // detail, and it is already logged in the service.
            return StatusCode(StatusCodes.Status502BadGateway, new
            {
                message = "Le service de reconnaissance d'écriture est momentanément indisponible.",
            });
        }
    }
}
