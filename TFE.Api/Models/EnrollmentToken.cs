namespace TFE.Api.Models;

public class EnrollmentToken
{
    public Guid Id { get; set; }

    public Guid PatientId { get; set; }
    public virtual Patient Patient { get; set; } = null!;

    public string TokenHash { get; set; } = string.Empty;
    public RelationshipType RoleTarget { get; set; }
    public DateTime ExpiresAt { get; set; }
    public bool IsUsed { get; set; }
}
