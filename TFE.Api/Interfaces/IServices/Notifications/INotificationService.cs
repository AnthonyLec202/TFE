using TFE.Api.DTOs.Notifications;

namespace TFE.Api.Interfaces.IServices.Notifications;

public interface INotificationService
{
    Task<IEnumerable<NotificationResponse>> GetUnreadNotificationsAsync(string userId);
    Task MarkAsReadAsync(Guid notificationId, string userId);

    /// <summary>
    /// Persists and broadcasts a NewPost notification to every care-team member
    /// other than the post author.
    /// </summary>
    Task NotifyNewPostAsync(Guid patientId, string authorUserId, Guid postId);

    /// <summary>
    /// Persists and broadcasts a NewComment notification to every care-team member
    /// other than the comment author.
    /// </summary>
    Task NotifyNewCommentAsync(Guid commentId);
}
