namespace TFE.Api.DTOs.Auth;

/// <summary>
/// Internal result returned by the auth/enrollment services to their controllers. Carries the raw JWT
/// and its expiry so the controller can issue the HttpOnly session cookie. The token is NEVER
/// serialised to the HTTP response body — controllers map this to a <see cref="CurrentUserResponse"/>.
/// </summary>
public class AuthResponse
{
    public string Token { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public IReadOnlyList<string> Roles { get; set; } = [];
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? ConsentGivenAt { get; set; }
    public string ConsentVersion { get; set; } = string.Empty;
}
