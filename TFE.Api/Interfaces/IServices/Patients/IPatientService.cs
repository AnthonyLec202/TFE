using TFE.Api.DTOs.Patients;

namespace TFE.Api.Interfaces.IServices.Patients;

public interface IPatientService
{
    Task<PatientResponse> CreatePatientAsync(CreatePatientRequest request, string currentUserId);
    Task<IEnumerable<PatientResponse>> GetPatientsForUserAsync(string userId);
    Task<PatientResponse> GetPatientByIdAsync(Guid patientId, string userId);
    Task<PatientResponse> UpdatePatientAsync(Guid patientId, UpdatePatientRequest request, string userId);
    Task DeletePatientAsync(Guid patientId, string userId);
}
