using TFE.Api.Models;

namespace TFE.Api.Interfaces.IRepositories;

public interface ISessionRepository
{
    /// <summary>
    /// Returns the sessions matching the given ids, including their linked patients.
    /// </summary>
    Task<List<Session>> GetByIdsWithPatientsAsync(IEnumerable<Guid> ids, CancellationToken cancellationToken = default);

    Task AddAsync(Session session, CancellationToken cancellationToken = default);
}
