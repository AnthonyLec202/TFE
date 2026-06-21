using TFE.Api.Models;

namespace TFE.Api.Interfaces.IRepositories;

public interface ITherapeuticToolRepository
{
    /// <summary>
    /// Returns the whole tool library, optionally narrowed by a free-text query (matched against
    /// Title or Description) and/or by Type and Theme. Filtering is pushed to the database; the
    /// local-first client performs its own zero-latency filtering against the IndexedDB cache.
    /// </summary>
    Task<List<TherapeuticTool>> GetAllAsync(
        string? query = null,
        ToolType? type = null,
        CbtTheme? theme = null,
        CancellationToken cancellationToken = default);

    Task<TherapeuticTool?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the tools matching the given ids (used when rebuilding a session's tool associations).
    /// </summary>
    Task<List<TherapeuticTool>> GetByIdsAsync(IEnumerable<Guid> ids, CancellationToken cancellationToken = default);

    /// <summary>
    /// Stages the insertion of a new tool. Persistence is committed by the caller via IUnitOfWork.
    /// </summary>
    Task AddAsync(TherapeuticTool tool, CancellationToken cancellationToken = default);

    /// <summary>
    /// Stages an update for an already-tracked tool. Persistence is committed by the caller via IUnitOfWork.
    /// </summary>
    void Update(TherapeuticTool tool);

    /// <summary>
    /// Stages the removal of the given tool. The associative join rows are removed by the configured
    /// ON DELETE CASCADE. Persistence is committed by the caller via IUnitOfWork.
    /// </summary>
    void Remove(TherapeuticTool tool);
}
