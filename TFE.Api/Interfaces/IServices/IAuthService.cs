using TFE.Api.DTOs;

namespace TFE.Api.Interfaces.IServices;

public interface IAuthService
{
    Task<AuthResponse?> LoginAsync(LoginRequest request);
    Task ForgotPasswordAsync(ForgotPasswordRequest request);
    Task ResetPasswordAsync(ResetPasswordRequest request);
}
