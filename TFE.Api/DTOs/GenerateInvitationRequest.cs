using System.ComponentModel.DataAnnotations;

namespace TFE.Api.DTOs;

public class GenerateInvitationRequest
{
    [Required(ErrorMessage = "Role target is required.")]
    public string RoleTarget { get; set; } = string.Empty;
}
