using TFE.Api.Models;

namespace TFE.Api.Interfaces.IRepositories;

public interface IPostRepository
{
    /// <summary>
    /// Returns all posts visible to the requesting user for the given patient,
    /// including their comments (ordered by creation date) and attachments.
    /// </summary>
    Task<List<Post>> GetWallForPatientAsync(Guid patientId, bool isAdmin, string userRelationshipRole, CancellationToken cancellationToken = default);

    Task<Post?> GetByIdAsync(Guid postId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Loads a post together with its comments (and their attachments) and its own attachments.
    /// </summary>
    Task<Post?> GetByIdWithDetailsAsync(Guid postId, CancellationToken cancellationToken = default);

    Task<List<Post>> GetByAuthorWithAttachmentsAsync(string userId);

    Task AddAsync(Post post);

    void Remove(Post post);

    /// <summary>
    /// Explicitly loads the Attachments navigation property for a tracked post.
    /// </summary>
    Task LoadAttachmentsAsync(Post post, CancellationToken cancellationToken = default);
}
