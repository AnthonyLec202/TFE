using TFE.Api.Models;

namespace TFE.Api.Interfaces.IRepositories;

public interface ICareTeamRepository
{
    /// <summary>
    /// Stages a new care-team membership. Persistence is committed by the caller via IUnitOfWork.
    /// </summary>
    Task AddAsync(CareTeam careTeam);

    Task<bool> IsUserInCareTeamAsync(string userId, Guid patientId);
    Task<CareTeam?> GetForUserAndPatientAsync(string userId, Guid patientId);

    /// <summary>
    /// Stages the removal of a care-team membership. Persistence is committed by the caller via IUnitOfWork.
    /// </summary>
    void Remove(CareTeam careTeam);

    /// <summary>
    /// Returns all CareTeam entries for the given patient, including the linked User,
    /// for efficient author-role resolution.
    /// </summary>
    Task<List<CareTeam>> GetByPatientIdWithUsersAsync(Guid patientId);
}
