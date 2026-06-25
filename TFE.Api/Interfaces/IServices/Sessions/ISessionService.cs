using TFE.Api.DTOs.Sessions;

namespace TFE.Api.Interfaces.IServices.Sessions;

public interface ISessionService
{
    Task SyncBatchAsync(SessionSyncBatchRequest request, string userId, CancellationToken cancellationToken);

    /// <summary>
    /// Returns all sessions readable by the user, decrypted, for cross-device hydration.
    /// </summary>
    Task<IEnumerable<SessionResponse>> GetSessionsForUserAsync(string userId, CancellationToken cancellationToken);

    /// <summary>
    /// Returns all session notes readable by the user, decrypted, for cross-device hydration.
    /// </summary>
    Task<IEnumerable<NoteResponse>> GetNotesForUserAsync(string userId, CancellationToken cancellationToken);

    Task UpdateAsync(Guid id, UpdateSessionRequest request, CancellationToken cancellationToken);

    Task DeleteAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>
    /// Generates an AI clinical report from the decrypted note of the given session. Enforces RBAC:
    /// the session's note must be readable by <paramref name="userId"/>. Throws
    /// <see cref="KeyNotFoundException"/> when no readable note exists for the session.
    /// </summary>
    Task<string> GenerateAiReportAsync(Guid sessionId, string userId, CancellationToken cancellationToken);
}
