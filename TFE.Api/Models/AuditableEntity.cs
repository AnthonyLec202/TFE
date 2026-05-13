namespace TFE.Api.Models;

public abstract class AuditableEntity
{
    public Guid Id { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public string? CreatedById { get; set; }
    public virtual ApplicationUser? CreatedBy { get; set; }
}
