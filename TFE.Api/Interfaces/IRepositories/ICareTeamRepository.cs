using TFE.Api.Models;

namespace TFE.Api.Interfaces.IRepositories;

public interface ICareTeamRepository
{
    Task<CareTeam> CreateAsync(CareTeam careTeam);
    Task<bool> IsUserInCareTeamAsync(string userId, Guid patientId);
    Task<CareTeam?> GetForUserAndPatientAsync(string userId, Guid patientId);

    /// <summary>
    /// Returns all CareTeam entries for the given patient, including the linked User,
    /// for efficient author-role resolution.
    /// </summary>
    Task<List<CareTeam>> GetByPatientIdWithUsersAsync(Guid patientId);
}
