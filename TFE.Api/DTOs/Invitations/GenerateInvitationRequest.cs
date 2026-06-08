using System.ComponentModel.DataAnnotations;

namespace TFE.Api.DTOs.Invitations;

public class GenerateInvitationRequest
{
    [Required(ErrorMessage = "Role target is required.")]
    public string RoleTarget { get; set; } = string.Empty;
}
