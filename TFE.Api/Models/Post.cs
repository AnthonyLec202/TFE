namespace TFE.Api.Models;

public class Post : AuditableEntity
{
    public Guid PatientId { get; set; }
    public virtual Patient Patient { get; set; } = null!;

    public string Content { get; set; } = string.Empty;

    // Array of RelationshipType string values (e.g. "Teacher") excluded from seeing this post.
    // Empty array = visible to everyone in the care team.
    public string[] ExcludedRoles { get; set; } = Array.Empty<string>();

    public virtual ICollection<Comment> Comments { get; set; }
    public virtual ICollection<Attachment> Attachments { get; set; }

    public Post()
    {
        Comments = new HashSet<Comment>();
        Attachments = new HashSet<Attachment>();
    }
}
