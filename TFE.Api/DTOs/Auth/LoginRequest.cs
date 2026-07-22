using System.ComponentModel.DataAnnotations;

namespace TFE.Api.DTOs.Auth;

public class LoginRequest
{
    [Required(ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Invalid email format.")]
    public string Email { get; set; } = string.Empty;

    // No length rule here: login only authenticates credentials, so it must accept any password the
    // policy allows. Enforcing a length would pre-reject valid credentials and leak the policy.
    [Required(ErrorMessage = "Password is required.")]
    public string Password { get; set; } = string.Empty;
}
