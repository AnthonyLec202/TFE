namespace TFE.Api.Models;

public class Notification
{
    public Guid Id { get; set; }

    public string UserId { get; set; } = string.Empty;
    public virtual ApplicationUser User { get; set; } = null!;

    public Guid PatientId { get; set; }
    public virtual Patient Patient { get; set; } = null!;

    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool IsRead { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    /// <summary>
    /// Client-side deep-link, e.g. /patients/{id}?postId={postId}&amp;commentId={commentId}.
    /// Null for legacy notifications that pre-date this field.
    /// </summary>
    public string? TargetUrl { get; set; }
}
