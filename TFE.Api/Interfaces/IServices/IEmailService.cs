namespace TFE.Api.Interfaces.IServices;

public interface IEmailService
{
    Task SendPasswordResetEmailAsync(string toEmail, string resetLink);
}
