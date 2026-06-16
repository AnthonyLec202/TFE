using TFE.Api.DTOs.Patients;

namespace TFE.Api.Interfaces.IServices.Patients;

public interface IPatientService
{
    Task<PatientResponse> CreatePatientAsync(CreatePatientRequest request, string currentUserId);
    Task<IEnumerable<PatientResponse>> GetPatientsForUserAsync(string userId);
    Task<PatientResponse> GetPatientByIdAsync(Guid patientId, string userId);
    Task<PatientResponse> UpdatePatientAsync(Guid patientId, UpdatePatientRequest request, string userId);
    Task DeletePatientAsync(Guid patientId, string userId);

    /// <summary>
    /// Returns the patient's care-team members. The requesting user must belong to the care team.
    /// </summary>
    Task<IEnumerable<CareTeamMemberResponse>> GetCareTeamAsync(Guid patientId, string currentUserId);

    /// <summary>
    /// Removes a member from the patient's care team. Restricted to the patient's administrator;
    /// the administrator membership itself cannot be removed.
    /// </summary>
    Task RemoveCareTeamMemberAsync(Guid patientId, string targetUserId, string currentUserId);

    /// <summary>
    /// Removes the requesting user from a patient's care team (self-leave). The patient's
    /// administrator cannot leave — they must delete the patient record instead.
    /// </summary>
    Task LeaveCareTeamAsync(Guid patientId, string userId);
}
