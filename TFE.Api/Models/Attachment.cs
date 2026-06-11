namespace TFE.Api.Models;

public class Attachment : AuditableEntity
{
    // Relative storage key inside the bucket (e.g. "{guid}.png"), NOT a public URL.
    // A short-lived signed URL is generated at runtime from this path.
    public string StoragePath { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string FileType { get; set; } = string.Empty;

    // XOR constraint enforced at the DB level: exactly one of these must be non-null.
    public Guid? PostId { get; set; }
    public virtual Post? Post { get; set; }

    public Guid? CommentId { get; set; }
    public virtual Comment? Comment { get; set; }
}
