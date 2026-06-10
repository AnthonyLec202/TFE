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

    [HttpPost("sync")]
    public async Task<IActionResult> SyncBatch(
        [FromBody] SessionSyncBatchRequest request,
        CancellationToken cancellationToken)
    {
        await _sessionService.SyncBatchAsync(request, cancellationToken);
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
