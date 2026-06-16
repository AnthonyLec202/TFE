namespace TFE.Api.Models;

public class Notification
{
    public Guid Id { get; set; }

    public string UserId { get; set; } = string.Empty;
    public virtual ApplicationUser User { get; set; } = null!;

    public Guid PatientId { get; set; }
    public virtual Patient Patient { get; set; } = null!;

    public NotificationType Type { get; set; }

    // Nullable: when the actor user is later deleted (GDPR erasure), EF sets this to null
    // rather than cascading the delete onto unrelated recipients' notifications.
    public string? ActorId { get; set; }
    public virtual ApplicationUser? Actor { get; set; }

    public bool IsRead { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>
    /// Client-side deep-link, e.g. /patients/{id}?postId={postId}&amp;commentId={commentId}.
    /// </summary>
    public string? TargetUrl { get; set; }
}
