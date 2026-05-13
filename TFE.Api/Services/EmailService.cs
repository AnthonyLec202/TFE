using TFE.Api.Interfaces.IServices;

namespace TFE.Api.Services;

public class EmailService : IEmailService
{
    private readonly ILogger<EmailService> _logger;

    public EmailService(ILogger<EmailService> logger)
    {
        _logger = logger;
    }

    public Task SendPasswordResetEmailAsync(string toEmail, string resetLink)
    {
        _logger.LogInformation(
            "[EmailService] Password reset requested for {Email}. Reset link: {ResetLink}",
            toEmail,
            resetLink);

        return Task.CompletedTask;
    }
}
