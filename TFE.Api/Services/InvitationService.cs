using System.Security.Cryptography;
using System.Text;
using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Interfaces.IServices;
using TFE.Api.Models;

namespace TFE.Api.Services;

public class InvitationService : IInvitationService
{
    private readonly IEnrollmentTokenRepository _tokenRepository;
    private readonly ICareTeamRepository _careTeamRepository;

    public InvitationService(
        IEnrollmentTokenRepository tokenRepository,
        ICareTeamRepository careTeamRepository)
    {
        _tokenRepository = tokenRepository;
        _careTeamRepository = careTeamRepository;
    }

    public async Task JoinPatientAsync(string userId, string secretCode)
    {
        var tokenHash = HashToken(secretCode.Trim());

        var token = await _tokenRepository.FindByHashAsync(tokenHash)
            ?? throw new InvalidOperationException("Invalid or already used invitation code.");

        if (token.IsUsed)
            throw new InvalidOperationException("This invitation code has already been used.");

        if (token.ExpiresAt < DateTime.UtcNow)
            throw new InvalidOperationException("This invitation code has expired.");

        if (await _careTeamRepository.IsUserInCareTeamAsync(userId, token.PatientId))
            throw new InvalidOperationException("You are already a member of this patient's care team.");

        var careTeam = new CareTeam
        {
            UserId = userId,
            PatientId = token.PatientId,
            Role = token.RoleTarget
        };

        await _careTeamRepository.CreateAsync(careTeam);
        await _tokenRepository.MarkAsUsedAsync(token);
    }

    private static string HashToken(string token)
    {
        var hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }
}
