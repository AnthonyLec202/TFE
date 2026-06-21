using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using TFE.Api.DTOs.Auth;
using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Interfaces.IServices.Auth;
using TFE.Api.Models;
using TFE.Api.Options;

namespace TFE.Api.Services.Auth;

public class AuthService : IAuthService
{
    private readonly IUserRepository _userRepository;
    private readonly IEmailService _emailService;
    private readonly IConfiguration _configuration;
    private readonly AppOptions _appOptions;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        IUserRepository userRepository,
        IEmailService emailService,
        IConfiguration configuration,
        IOptions<AppOptions> appOptions,
        ILogger<AuthService> logger)
    {
        _userRepository = userRepository;
        _emailService = emailService;
        _configuration = configuration;
        _appOptions = appOptions.Value;
        _logger = logger;
    }

    public async Task<AuthResponse?> LoginAsync(LoginRequest request)
    {
        var user = await _userRepository.FindByEmailAsync(request.Email);
        if (user is null) return null;

        var passwordValid = await _userRepository.CheckPasswordAsync(user, request.Password);
        if (!passwordValid) return null;

        var roles = await _userRepository.GetRolesAsync(user);
        var expiresAt = DateTimeOffset.UtcNow.AddMinutes(
            double.Parse(_configuration["Jwt:ExpiresInMinutes"]!));
        var token = GenerateJwtToken(user, roles, expiresAt.UtcDateTime);

        return new AuthResponse
        {
            Token = token,
            UserId = user.Id,
            Email = user.Email!,
            Roles = roles.ToList(),
            ExpiresAt = expiresAt,
            ConsentGivenAt = user.ConsentGivenAt,
            ConsentVersion = user.ConsentVersion ?? string.Empty,
        };
    }

    public async Task ForgotPasswordAsync(ForgotPasswordRequest request)
    {
        var user = await _userRepository.FindByEmailAsync(request.Email);

        // Always return normally — never reveal whether the email exists (prevents enumeration)
        if (user is null) return;

        var rawToken = await _userRepository.GeneratePasswordResetTokenAsync(user);
        var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(rawToken));

        var resetLink = $"{_appOptions.FrontendBaseUrl}/reset-password" +
                        $"?email={Uri.EscapeDataString(user.Email!)}" +
                        $"&token={encodedToken}";

        try
        {
            await _emailService.SendPasswordResetEmailAsync(user.Email!, resetLink);
        }
        catch (Exception ex)
        {
            // Swallow delivery failures: the endpoint must return the same response whether or
            // not the address exists, so we never propagate an error that could leak existence.
            // Log the internal user id rather than the email address (PII / data minimization).
            _logger.LogError(ex, "Password reset email delivery failed for user {UserId}.", user.Id);
        }
    }

    public async Task ResetPasswordAsync(ResetPasswordRequest request)
    {
        var user = await _userRepository.FindByEmailAsync(request.Email)
                   ?? throw new InvalidOperationException("Invalid password reset request.");

        var rawToken = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(request.Token));

        var result = await _userRepository.ResetPasswordAsync(user, rawToken, request.NewPassword);
        if (!result.Succeeded)
        {
            var errors = string.Join(" | ", result.Errors.Select(e => $"{e.Code}: {e.Description}"));
            throw new InvalidOperationException($"Password reset failed: {errors}");
        }
    }

    public async Task ChangePasswordAsync(string userId, ChangePasswordRequest request)
    {
        var user = await _userRepository.FindByIdAsync(userId)
                   ?? throw new KeyNotFoundException("User not found.");

        var result = await _userRepository.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            var errors = string.Join(" | ", result.Errors.Select(e => $"{e.Code}: {e.Description}"));
            throw new InvalidOperationException($"Password change failed: {errors}");
        }
    }

    public async Task UpdateConsentAsync(string userId, string version)
    {
        var user = await _userRepository.FindByIdAsync(userId)
                   ?? throw new KeyNotFoundException("User not found.");

        user.ConsentVersion = version;
        user.ConsentGivenAt = DateTimeOffset.UtcNow;

        var result = await _userRepository.UpdateAsync(user);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            throw new InvalidOperationException($"Consent update failed: {errors}");
        }
    }

    private string GenerateJwtToken(ApplicationUser user, IEnumerable<string> roles, DateTime expiry)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]!));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email!),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        // Append role claims so [Authorize(Roles = "...")] works on controllers
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: expiry,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
