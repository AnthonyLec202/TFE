using System.Security.Cryptography;
using System.Text;
using TFE.Api.Interfaces;
using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Interfaces.IServices.Invitations;
using TFE.Api.Models;

namespace TFE.Api.Services.Invitations;

public class InvitationService : IInvitationService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IEnrollmentTokenRepository _tokenRepository;
    private readonly ICareTeamRepository _careTeamRepository;

    public InvitationService(
        IUnitOfWork unitOfWork,
        IEnrollmentTokenRepository tokenRepository,
        ICareTeamRepository careTeamRepository)
    {
        _unitOfWork = unitOfWork;
        _tokenRepository = tokenRepository;
        _careTeamRepository = careTeamRepository;
    }

    public async Task JoinPatientAsync(string userId, string secretCode)
    {
        var tokenHash = HashToken(secretCode.Trim());

        var token = await _tokenRepository.FindByHashAsync(tokenHash)
            ?? throw new InvalidOperationException("Code d'invitation invalide ou déjà utilisé.");

        if (token.IsUsed)
            throw new InvalidOperationException("Ce code d'invitation a déjà été utilisé.");

        if (token.ExpiresAt < DateTime.UtcNow)
            throw new InvalidOperationException("Ce code d'invitation a expiré.");

        if (await _careTeamRepository.IsUserInCareTeamAsync(userId, token.PatientId))
            throw new InvalidOperationException("Vous faites déjà partie de l'équipe de soin de ce patient.");

        var careTeam = new CareTeam
        {
            UserId = userId,
            PatientId = token.PatientId,
            Role = token.RoleTarget
        };

        // Joining the care team and burning the code must land together. Previously the repository
        // committed the membership on its own, before MarkAsUsedAsync ran: a failure between the two
        // left the user joined while the code stayed unused — a still-redeemable invitation. The
        // transaction makes that window impossible.
        await using var transaction = await _unitOfWork.BeginTransactionAsync();
        try
        {
            await _careTeamRepository.AddAsync(careTeam);
            await _unitOfWork.SaveChangesAsync();
            await _tokenRepository.MarkAsUsedAsync(token);

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    private static string HashToken(string token)
    {
        var hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }
}
