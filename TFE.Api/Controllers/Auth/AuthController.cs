using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TFE.Api.DTOs.Auth;
using TFE.Api.Extensions;
using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Interfaces.IServices.Auth;

namespace TFE.Api.Controllers.Auth;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IUserRepository _userRepository;

    public AuthController(IAuthService authService, IUserRepository userRepository)
    {
        _authService = authService;
        _userRepository = userRepository;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var response = await _authService.LoginAsync(request);
        if (response is null)
            return Unauthorized(new { message = "Invalid email or password." });

        // Issue the JWT as an HttpOnly cookie; never expose the token to JavaScript (F-02).
        Response.AppendAuthCookie(response.Token, response.ExpiresAt);
        return Ok(ToCurrentUser(response));
    }

    // Fetches the authenticated user's real-time identity from the database rather than reading
    // consent fields from JWT claims. The JWT remains strictly stateless (sub + email + roles);
    // mutable state (ConsentGivenAt, ConsentVersion) is always resolved to its current DB value.
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                     ?? User.FindFirst("sub")?.Value;
        if (userId is null)
            return Unauthorized();

        var user = await _userRepository.FindByIdAsync(userId);
        if (user is null)
            return Unauthorized();

        return Ok(new CurrentUserResponse
        {
            UserId = user.Id,
            Email = user.Email ?? string.Empty,
            // Roles are read from JWT claims — they are immutable for the duration of the session
            // and do not require a DB round-trip.
            Roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList(),
            ConsentGivenAt = user.ConsentGivenAt,
            ConsentVersion = user.ConsentVersion ?? string.Empty,
        });
    }

    // Records that the authenticated user has accepted the specified policy version. Called by the
    // ConsentBumpModal when the user has read and accepted the updated Terms of Service.
    [HttpPost("me/consent")]
    [Authorize]
    public async Task<IActionResult> UpdateConsent([FromBody] UpdateConsentRequest request)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                     ?? User.FindFirst("sub")?.Value;
        if (userId is null)
            return Unauthorized();

        try
        {
            await _authService.UpdateConsentAsync(userId, request.Version);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public IActionResult Logout()
    {
        // Clear the cookie regardless of token validity, so an expired session can still log out.
        Response.ClearAuthCookie();
        return NoContent();
    }

    private static CurrentUserResponse ToCurrentUser(AuthResponse response) => new()
    {
        UserId = response.UserId,
        Email = response.Email,
        Roles = response.Roles,
        ConsentGivenAt = response.ConsentGivenAt,
        ConsentVersion = response.ConsentVersion,
    };

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    [EnableRateLimiting("ForgotPasswordPolicy")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        await _authService.ForgotPasswordAsync(request);

        // Always return 200 to prevent email enumeration
        return Ok(new { message = "If an account with that email exists, a reset link has been sent." });
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        try
        {
            await _authService.ResetPasswordAsync(request);
            return Ok(new { message = "Password has been reset successfully." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                     ?? User.FindFirst("sub")?.Value;
        if (userId is null)
            return Unauthorized();

        try
        {
            await _authService.ChangePasswordAsync(userId, request);
            return Ok(new { message = "Password has been changed successfully." });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
