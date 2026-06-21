namespace TFE.Api.DTOs.Auth;

/// <summary>
/// The authenticated user's public identity, returned by login, enrollment, and GET /api/auth/me.
/// Contains no token — the JWT lives only in the HttpOnly cookie. The client uses UserId to derive
/// its at-rest IndexedDB encryption key and Roles to drive role-based UI.
/// </summary>
public class CurrentUserResponse
{
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public IReadOnlyList<string> Roles { get; set; } = [];
    public DateTimeOffset? ConsentGivenAt { get; set; }
    public string ConsentVersion { get; set; } = string.Empty;
}
