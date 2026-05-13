using System.ComponentModel.DataAnnotations;

namespace TFE.Api.DTOs;

public class AuthResponse
{
    [Required] public string Token { get; set; } = string.Empty;
    [Required] public string UserId { get; set; } = string.Empty;
    [Required] public string Email { get; set; } = string.Empty;

    public AuthResponse() { }

    public AuthResponse(string token, string userId, string email)
    {
        Token = token;
        UserId = userId;
        Email = email;
    }
}
