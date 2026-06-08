using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TFE.Api.DTOs.Invitations;
using TFE.Api.Interfaces.IServices.Invitations;

namespace TFE.Api.Controllers.Invitations;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class InvitationsController : ControllerBase
{
    private readonly IInvitationService _invitationService;

    public InvitationsController(IInvitationService invitationService)
    {
        _invitationService = invitationService;
    }

    /// <summary>
    /// Joins the authenticated user to a patient's care team using an invitation code.
    /// The code is consumed immediately and cannot be reused.
    /// </summary>
    /// <param name="request">The invitation code to consume.</param>
    [HttpPost("consume")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Consume([FromBody] ConsumeInvitationRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException("User identity not found.");

        try
        {
            await _invitationService.JoinPatientAsync(userId, request.SecretCode);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
