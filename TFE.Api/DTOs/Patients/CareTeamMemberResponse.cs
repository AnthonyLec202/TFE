using System.ComponentModel.DataAnnotations;

namespace TFE.Api.DTOs.Patients;

/// <summary>
/// A single care-team member attached to a patient, shaped for the "Voir membres" list.
/// </summary>
public class CareTeamMemberResponse
{
    [Required] public string UserId { get; set; } = string.Empty;
    [Required] public string FirstName { get; set; } = string.Empty;
    [Required] public string LastName { get; set; } = string.Empty;

    /// <summary>
    /// Coarse role relative to the patient ("Admin", "Parent", "Collaborator"), resolved with the
    /// same rules as <see cref="PatientResponse.UserRole"/>.
    /// </summary>
    [Required] public string Role { get; set; } = string.Empty;

    /// <summary>
    /// Human-readable French relationship label (e.g. "Psychologue", "Enseignant(e)"), for display
    /// only. Produced by CareTeamRoleLabels — never branch on it, use Role for that.
    /// </summary>
    [Required] public string Relationship { get; set; } = string.Empty;
}
