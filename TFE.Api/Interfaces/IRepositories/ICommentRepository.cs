using TFE.Api.Models;

namespace TFE.Api.Interfaces.IRepositories;

public interface ICommentRepository
{
    /// <summary>
    /// Loads a comment together with its parent post and its attachments.
    /// </summary>
    Task<Comment?> GetByIdWithDetailsAsync(Guid commentId, CancellationToken cancellationToken = default);

    Task<List<Comment>> GetByAuthorWithAttachmentsAsync(string userId);

    Task AddAsync(Comment comment);

    void Remove(Comment comment);

    /// <summary>
    /// Explicitly loads the Attachments navigation property for a tracked comment.
    /// </summary>
    Task LoadAttachmentsAsync(Comment comment, CancellationToken cancellationToken = default);
}
