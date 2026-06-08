namespace TFE.Api.Interfaces.IServices.Auth;

public interface IEmailService
{
    Task SendPasswordResetEmailAsync(string toEmail, string resetLink);
}
