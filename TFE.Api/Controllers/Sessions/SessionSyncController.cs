using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TFE.Api.DTOs.Sessions;
using TFE.Api.Interfaces.IServices.Sessions;

namespace TFE.Api.Controllers.Sessions;

[ApiController]
[Route("api/sessions")]
[Authorize(Roles = "Admin")]
public class SessionSyncController : ControllerBase
{
    private readonly ISessionService _sessionService;

    public SessionSyncController(ISessionService sessionService)
    {
        _sessionService = sessionService;
    }

    private string CurrentUserId =>
        User.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? User.FindFirst("sub")?.Value
        ?? throw new InvalidOperationException("Authenticated user ID not found in token.");

    // Cross-device read: hydrate the caller's sessions (decrypted) into the offline-first client.
    [HttpGet]
    public async Task<IActionResult> GetSessions(CancellationToken cancellationToken)
    {
        var sessions = await _sessionService.GetSessionsForUserAsync(CurrentUserId, cancellationToken);
        return Ok(sessions);
    }

    // Cross-device read: hydrate the caller's session notes (decrypted) into the offline-first client.
    [HttpGet("notes")]
    public async Task<IActionResult> GetNotes(CancellationToken cancellationToken)
    {
        var notes = await _sessionService.GetNotesForUserAsync(CurrentUserId, cancellationToken);
        return Ok(notes);
    }

    [HttpPost("sync")]
    public async Task<IActionResult> SyncBatch(
        [FromBody] SessionSyncBatchRequest request,
        CancellationToken cancellationToken)
    {
        await _sessionService.SyncBatchAsync(request, CurrentUserId, cancellationToken);
        return Ok();
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateSession(
        Guid id,
        [FromBody] UpdateSessionRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            await _sessionService.UpdateAsync(id, request, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    // Generates an AI clinical report from the session's decrypted note. RBAC is enforced in the
    // service (the note must be readable by the caller); the [Authorize(Roles = "Admin")] guard on
    // the controller already restricts the endpoint to clinicians.
    [HttpPost("{sessionId:guid}/generate-ai-report")]
    public async Task<IActionResult> GenerateAiReport(Guid sessionId, CancellationToken cancellationToken)
    {
        try
        {
            var report = await _sessionService.GenerateAiReportAsync(sessionId, CurrentUserId, cancellationToken);
            return Ok(new AiReportResponse { Report = report });
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteSession(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            await _sessionService.DeleteAsync(id, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }
}
