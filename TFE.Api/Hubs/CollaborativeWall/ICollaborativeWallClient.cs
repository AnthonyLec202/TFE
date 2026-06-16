using TFE.Api.DTOs.CollaborativeWall;
using TFE.Api.DTOs.Notifications;

namespace TFE.Api.Hubs.CollaborativeWall;

// Strongly-typed contract for messages pushed from the server to connected clients.
public interface ICollaborativeWallClient
{
    Task ReceiveNewPost(PostResponse post);
    Task ReceiveUpdatedPost(PostResponse post);
    Task ReceiveDeletedPost(Guid postId);
    Task ReceiveNewComment(CommentResponse comment);
    Task ReceiveUpdatedComment(CommentResponse comment);
    Task ReceiveDeletedComment(Guid postId, Guid commentId);
    Task ReceiveNotification(NotificationResponse notification);
}
