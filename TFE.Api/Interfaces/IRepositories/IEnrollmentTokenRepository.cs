using TFE.Api.Models;

namespace TFE.Api.Interfaces.IRepositories;

public interface IEnrollmentTokenRepository
{
    Task<EnrollmentToken> CreateAsync(EnrollmentToken token);
    Task<EnrollmentToken?> FindByHashAsync(string tokenHash);
    Task MarkAsUsedAsync(EnrollmentToken token);
}
