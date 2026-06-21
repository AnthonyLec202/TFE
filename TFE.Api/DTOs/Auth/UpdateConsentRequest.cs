using System.ComponentModel.DataAnnotations;

namespace TFE.Api.DTOs.Auth;

public class UpdateConsentRequest
{
    [Required]
    public string Version { get; set; } = string.Empty;
}
