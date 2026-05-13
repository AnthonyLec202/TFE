namespace TFE.Api.Models;

public class Comment : AuditableEntity
{
    public Guid PostId { get; set; }
    public virtual Post Post { get; set; } = null!;

    public string Content { get; set; } = string.Empty;

    public virtual ICollection<Attachment> Attachments { get; set; }

    public Comment()
    {
        Attachments = new HashSet<Attachment>();
    }
}
