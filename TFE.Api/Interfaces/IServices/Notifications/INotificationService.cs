using TFE.Api.DTOs.CollaborativeWall;
using TFE.Api.DTOs.Notifications;

namespace TFE.Api.Interfaces.IServices.Notifications;

public interface INotificationService
{
    Task<IEnumerable<NotificationResponse>> GetUnreadNotificationsAsync(string userId);
    Task MarkAsReadAsync(Guid notificationId, string userId);

    /// <summary>
    /// Persists and broadcasts a notification to every member of the patient's care team
    /// other than the author of the new post.
    /// </summary>
    Task NotifyNewPostAsync(Guid patientId, string authorUserId, PostResponse post);

    /// <summary>
    /// Persists and broadcasts a notification to every member of the patient's care team
    /// other than the author of the new comment.
    /// </summary>
    Task NotifyNewCommentAsync(Guid commentId);
}
