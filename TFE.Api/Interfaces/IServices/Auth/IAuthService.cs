using TFE.Api.DTOs.Auth;

namespace TFE.Api.Interfaces.IServices.Auth;

public interface IAuthService
{
    Task<AuthResponse?> LoginAsync(LoginRequest request);
    Task ForgotPasswordAsync(ForgotPasswordRequest request);
    Task ResetPasswordAsync(ResetPasswordRequest request);
    Task ChangePasswordAsync(string userId, ChangePasswordRequest request);
    Task UpdateConsentAsync(string userId, string version);
}
