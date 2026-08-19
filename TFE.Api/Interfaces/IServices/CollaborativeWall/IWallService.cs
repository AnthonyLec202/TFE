using TFE.Api.DTOs.CollaborativeWall;

namespace TFE.Api.Interfaces.IServices.CollaborativeWall;

public interface IWallService
{
    /// <summary>
    /// Resolves the SignalR group a user must join to receive this patient's wall events, or null when
    /// the user is not on the care team. Consumed by the hub, which must not resolve care-team
    /// membership itself.
    /// </summary>
    Task<string?> ResolveWallGroupAsync(string userId, Guid patientId);

    Task<IEnumerable<PostResponse>> GetWallAsync(Guid patientId, string currentUserId);
    Task<PostResponse> CreatePostAsync(Guid patientId, CreatePostRequest request, string currentUserId);
    Task<PostResponse> CreatePostWithAttachmentsAsync(Guid patientId, string currentUserId, CreatePostFormRequest request, CancellationToken cancellationToken);
    Task<PostResponse> UpdatePostAsync(Guid postId, UpdatePostRequest request, string currentUserId);
    Task DeletePostAsync(Guid postId, string currentUserId);
    Task<CommentResponse> CreateCommentAsync(Guid postId, CreateCommentRequest request, string currentUserId);
    Task<CommentResponse> CreateCommentWithAttachmentsAsync(Guid patientId, Guid postId, string currentUserId, CreateCommentFormRequest request, CancellationToken cancellationToken);
    Task<CommentResponse> UpdateCommentAsync(Guid commentId, UpdateCommentRequest request, string currentUserId);
    Task DeleteCommentAsync(Guid commentId, string currentUserId);
}
