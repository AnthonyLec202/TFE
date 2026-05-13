using System.ComponentModel.DataAnnotations;

namespace TFE.Api.DTOs;

public class PatientResponse
{
    [Required] public Guid Id { get; set; }
    [Required] public string FirstName { get; set; } = string.Empty;
    [Required] public string LastName { get; set; } = string.Empty;
    [Required] public DateOnly BirthDate { get; set; }

    /// <summary>
    /// The requesting user's role relative to this patient ("Admin", "Parent", "Collaborator").
    /// </summary>
    [Required] public string UserRole { get; set; } = string.Empty;
}
