using System.ComponentModel.DataAnnotations;

namespace TFE.Api.DTOs.Auth;

public class ChangePasswordRequest
{
    [Required(ErrorMessage = "Current password is required.")]
    public string CurrentPassword { get; set; } = string.Empty;

    // The password policy (minimum length) is enforced centrally by ASP.NET Core Identity — see the
    // IdentityOptions configuration in Program.cs. The DTO only guards presence, so the policy lives
    // in a single place. Identity rejections surface as a 400 via the service layer.
    [Required(ErrorMessage = "New password is required.")]
    public string NewPassword { get; set; } = string.Empty;
}
