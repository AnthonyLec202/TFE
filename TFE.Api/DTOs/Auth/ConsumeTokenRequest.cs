using System.ComponentModel.DataAnnotations;

namespace TFE.Api.DTOs.Auth;

public class ConsumeTokenRequest
{
    [Required(ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Invalid email format.")]
    public string Email { get; set; } = string.Empty;

    // Password policy (minimum length) is enforced centrally by ASP.NET Core Identity — see the
    // IdentityOptions configuration in Program.cs. The DTO only guards presence.
    [Required(ErrorMessage = "Password is required.")]
    public string Password { get; set; } = string.Empty;

    [Required(ErrorMessage = "First name is required.")]
    [StringLength(100, MinimumLength = 1, ErrorMessage = "First name must be between 1 and 100 characters.")]
    public string FirstName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Last name is required.")]
    [StringLength(100, MinimumLength = 1, ErrorMessage = "Last name must be between 1 and 100 characters.")]
    public string LastName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Secret code is required.")]
    [StringLength(8, MinimumLength = 8, ErrorMessage = "Secret code must be exactly 8 characters.")]
    public string SecretCode { get; set; } = string.Empty;

    // GDPR: the user must explicitly accept data collection. Must be true to create the account.
    [Range(typeof(bool), "true", "true", ErrorMessage = "Consent to data collection is required.")]
    public bool Consent { get; set; }
}
