using System.ComponentModel.DataAnnotations;

namespace TFE.Api.DTOs.Invitations;

public class ConsumeInvitationRequest
{
    [Required]
    [StringLength(8, MinimumLength = 8)]
    public string SecretCode { get; set; } = string.Empty;
}
