using TFE.Api.Models;

namespace TFE.Api.Interfaces.IRepositories;

public interface INoteRepository
{
    Task<List<Note>> GetBySessionIdsAsync(IEnumerable<Guid> sessionIds, CancellationToken cancellationToken = default);

    void RemoveRange(IEnumerable<Note> notes);

    Task AddAsync(Note note, CancellationToken cancellationToken = default);
}
