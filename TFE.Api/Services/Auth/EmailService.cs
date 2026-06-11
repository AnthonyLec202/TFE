using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;
using TFE.Api.Interfaces.IServices.Auth;
using TFE.Api.Options;

namespace TFE.Api.Services.Auth;

public class EmailService : IEmailService
{
    private readonly EmailOptions _options;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IOptions<EmailOptions> options, ILogger<EmailService> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendPasswordResetEmailAsync(string toEmail, string resetLink)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_options.FromName, _options.FromAddress));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = "Réinitialisation de votre mot de passe";
        message.Body = new BodyBuilder
        {
            HtmlBody = BuildHtmlBody(resetLink),
            TextBody = BuildTextBody(resetLink),
        }.ToMessageBody();

        try
        {
            using var client = new SmtpClient();
            await client.ConnectAsync(_options.SmtpHost, _options.SmtpPort, SecureSocketOptions.StartTls);
            await client.AuthenticateAsync(_options.SmtpUser, _options.SmtpPassword);
            await client.SendAsync(message);
            await client.DisconnectAsync(true);

            // Do not log the recipient address (PII / data minimization).
            _logger.LogInformation("Password reset email sent successfully.");
        }
        catch (Exception ex)
        {
            // Surface the failure to the caller; the forgot-password flow swallows it to
            // preserve anti-enumeration (it must not reveal whether the address exists).
            // The recipient address is intentionally omitted from the log (PII).
            _logger.LogError(ex, "Failed to send password reset email.");
            throw;
        }
    }

    private static string BuildHtmlBody(string resetLink) => $"""
        <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
          <h2 style="font-size: 18px;">Réinitialisation de votre mot de passe</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous
            pour en choisir un nouveau. Ce lien expirera dans 2 heures.
          </p>
          <p style="margin: 24px 0;">
            <a href="{resetLink}"
               style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none;
                      padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600;">
              Réinitialiser mon mot de passe
            </a>
          </p>
          <p style="font-size: 12px; color: #94a3b8; line-height: 1.6;">
            Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.
            Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br />
            <span style="word-break: break-all;">{resetLink}</span>
          </p>
        </div>
        """;

    private static string BuildTextBody(string resetLink) =>
        "Réinitialisation de votre mot de passe\n\n" +
        "Vous avez demandé à réinitialiser votre mot de passe. Ouvrez ce lien pour en choisir un nouveau " +
        "(il expire dans 2 heures) :\n" +
        $"{resetLink}\n\n" +
        "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.";
}
