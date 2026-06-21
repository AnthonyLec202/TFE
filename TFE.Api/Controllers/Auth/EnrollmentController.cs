using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TFE.Api.DTOs.Auth;
using TFE.Api.Extensions;
using TFE.Api.Interfaces.IServices.Auth;

namespace TFE.Api.Controllers.Auth;

[ApiController]
[Route("api/enrollment")]
public class EnrollmentController : ControllerBase
{
    private readonly IEnrollmentService _enrollmentService;

    public EnrollmentController(IEnrollmentService enrollmentService)
    {
        _enrollmentService = enrollmentService;
    }

    [HttpPost("consume")]
    [AllowAnonymous]
    public async Task<IActionResult> ConsumeToken([FromBody] ConsumeTokenRequest request)
    {
        try
        {
            var response = await _enrollmentService.ConsumeTokenAsync(request);

            // Same cookie-based session issuance as login (F-02): token in an HttpOnly cookie only.
            Response.AppendAuthCookie(response.Token, response.ExpiresAt);
            return Ok(new CurrentUserResponse
            {
                UserId = response.UserId,
                Email = response.Email,
                Roles = response.Roles,
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
