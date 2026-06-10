using TFE.Api.DTOs.Sessions;

namespace TFE.Api.Interfaces.IServices.Sessions;

public interface ISessionService
{
    Task SyncBatchAsync(SessionSyncBatchRequest request, CancellationToken cancellationToken);

    Task UpdateAsync(Guid id, UpdateSessionRequest request, CancellationToken cancellationToken);

    Task DeleteAsync(Guid id, CancellationToken cancellationToken);
}
