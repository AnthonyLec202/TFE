namespace TFE.Api.Models;

public class CareTeam
{
    public string UserId { get; set; } = string.Empty;
    public virtual ApplicationUser User { get; set; } = null!;

    public Guid PatientId { get; set; }
    public virtual Patient Patient { get; set; } = null!;

    public RelationshipType Role { get; set; }

    // Stores a display label when Role == RelationshipType.Other; no effect on authorization logic.
    public string? CustomRoleName { get; set; }
}
