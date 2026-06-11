using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TFE.Api.Interfaces.IServices.Patients;

namespace TFE.Api.Controllers.Patients;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;

    public UsersController(IUserService userService)
    {
        _userService = userService;
    }

    /// <summary>
    /// Permanently deletes a user account (GDPR Right to Erasure).
    /// Anonymises all posts and comments authored by the user, removes all their attachments,
    /// and revokes their care-team access across all patients.
    /// </summary>
    /// <param name="id">The ID of the user to delete.</param>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> DeleteUser(string id)
    {
        // A user may only delete their own account: the route id must match the JWT subject.
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                            ?? User.FindFirst("sub")?.Value;
        if (currentUserId is null)
            return Unauthorized();
        if (!string.Equals(currentUserId, id, StringComparison.Ordinal))
            return Forbid();

        try
        {
            await _userService.DeleteUserAsync(id);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }
}
