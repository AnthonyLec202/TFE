using TFE.Api.Models;

namespace TFE.Api.Interfaces.IRepositories;

public interface INoteRepository
{
    Task<List<Note>> GetBySessionIdsAsync(IEnumerable<Guid> sessionIds, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns every note the given user may read: those attached to a session involving at least one
    /// patient in the user's care team. Content is decrypted by EF Core on materialization.
    /// </summary>
    Task<List<Note>> GetForUserAsync(string userId, CancellationToken cancellationToken = default);

    void RemoveRange(IEnumerable<Note> notes);

    Task AddAsync(Note note, CancellationToken cancellationToken = default);
}
