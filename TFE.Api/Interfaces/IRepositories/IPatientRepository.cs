using TFE.Api.Models;

namespace TFE.Api.Interfaces.IRepositories;

public interface IPatientRepository
{
    Task<Patient> CreateAsync(Patient patient);
    Task<Patient?> GetByIdAsync(Guid id);
    Task<IEnumerable<Patient>> GetByUserIdAsync(string userId);
    Task<Patient> UpdateAsync(Patient patient);
    Task DeleteAsync(Patient patient);
}
