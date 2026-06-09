using TFE.Api.DTOs.Sessions;

namespace TFE.Api.Interfaces.IServices.Sessions;

public interface ISessionService
{
    Task SyncBatchAsync(SessionSyncBatchRequest request, CancellationToken cancellationToken);
}
