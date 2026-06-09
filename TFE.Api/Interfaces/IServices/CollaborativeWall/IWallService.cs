using TFE.Api.DTOs.CollaborativeWall;

namespace TFE.Api.Interfaces.IServices.CollaborativeWall;

public interface IWallService
{
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
