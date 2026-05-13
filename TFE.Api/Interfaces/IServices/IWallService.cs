using TFE.Api.DTOs;

namespace TFE.Api.Interfaces.IServices;

public interface IWallService
{
    Task<IEnumerable<PostResponse>> GetWallAsync(Guid patientId, string currentUserId);
    Task<PostResponse> CreatePostAsync(Guid patientId, CreatePostRequest request, string currentUserId);
    Task<PostResponse> UpdatePostAsync(Guid postId, UpdatePostRequest request, string currentUserId);
    Task DeletePostAsync(Guid postId, string currentUserId);
    Task<CommentResponse> CreateCommentAsync(Guid postId, CreateCommentRequest request, string currentUserId);
    Task<CommentResponse> UpdateCommentAsync(Guid commentId, UpdateCommentRequest request, string currentUserId);
    Task DeleteCommentAsync(Guid commentId, string currentUserId);
}
