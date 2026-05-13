namespace TFE.Api.Models;

public class Attachment : AuditableEntity
{
    public string FileUrl { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string FileType { get; set; } = string.Empty;

    // XOR constraint enforced at the DB level: exactly one of these must be non-null.
    public Guid? PostId { get; set; }
    public virtual Post? Post { get; set; }

    public Guid? CommentId { get; set; }
    public virtual Comment? Comment { get; set; }
}
