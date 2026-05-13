using System.ComponentModel.DataAnnotations;

namespace TFE.Api.DTOs;

public class InvitationResponse
{
    [Required] public string PlainSecretCode { get; set; } = string.Empty;
    [Required] public DateTime ExpiresAt { get; set; }
}
