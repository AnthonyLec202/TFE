using TFE.Api.Models;

namespace TFE.Api.Interfaces.IRepositories;

public interface ISessionRepository
{
    /// <summary>
    /// Returns the sessions matching the given ids, including their linked patients.
    /// </summary>
    Task<List<Session>> GetByIdsWithPatientsAsync(IEnumerable<Guid> ids, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns every session readable by the given user — those involving at least one patient in the
    /// user's care team — with patients, tools and attendances loaded. Read-only (AsNoTracking); Title
    /// is decrypted by EF Core on materialization. For cross-device hydration.
    /// </summary>
    Task<List<Session>> GetForUserAsync(string userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns a single session with its linked patients loaded (for update/delete flows), or null if not found.
    /// </summary>
    Task<Session?> GetByIdWithPatientsAsync(Guid id, CancellationToken cancellationToken = default);

    Task AddAsync(Session session, CancellationToken cancellationToken = default);

    /// <summary>
    /// Purges all attendance rows for the given sessions via an immediate set-based DELETE
    /// (ExecuteDeleteAsync), bypassing the change tracker. This avoids the DbUpdateConcurrencyException
    /// that arose from deleting tracked navigation-collection entities during sync batch processing.
    /// The DELETE participates in the caller's ambient transaction.
    /// </summary>
    Task DeleteAttendancesBySessionIdsAsync(IEnumerable<Guid> sessionIds, CancellationToken cancellationToken = default);

    /// <summary>
    /// Stages the insertion of new attendance rows. Persistence is committed by the caller via IUnitOfWork.
    /// </summary>
    Task AddAttendancesAsync(IEnumerable<SessionAttendance> attendances, CancellationToken cancellationToken = default);

    /// <summary>
    /// Stages an update for an already-tracked session. Persistence is committed by the caller via IUnitOfWork.
    /// </summary>
    Task UpdateAsync(Session session, CancellationToken cancellationToken = default);

    /// <summary>
    /// Stages the removal of the session with the given id. Returns false if no such session exists.
    /// The associated Note, SessionNotes and PatientSession join rows are removed by the configured
    /// ON DELETE CASCADE foreign keys. Persistence is committed by the caller via IUnitOfWork.
    /// </summary>
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
