using System.Security.Cryptography;
using System.Text;
using TFE.Api.DTOs.Auth;
using TFE.Api.DTOs.Invitations;
using TFE.Api.Interfaces;
using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Interfaces.IServices.Auth;
using TFE.Api.Models;

namespace TFE.Api.Services.Auth;

public class EnrollmentService : IEnrollmentService
{
    // Bump this constant whenever the privacy policy / terms of use are materially updated.
    private const string CurrentConsentVersion = "v1.1";

    private readonly IUnitOfWork _unitOfWork;
    private readonly IEnrollmentTokenRepository _tokenRepository;
    private readonly ICareTeamRepository _careTeamRepository;
    private readonly IUserRepository _userRepository;
    private readonly IAuthService _authService;

    public EnrollmentService(
        IUnitOfWork unitOfWork,
        IEnrollmentTokenRepository tokenRepository,
        ICareTeamRepository careTeamRepository,
        IUserRepository userRepository,
        IAuthService authService)
    {
        _unitOfWork = unitOfWork;
        _tokenRepository = tokenRepository;
        _careTeamRepository = careTeamRepository;
        _userRepository = userRepository;
        _authService = authService;
    }

    public async Task<AuthResponse> ConsumeTokenAsync(ConsumeTokenRequest request)
    {
        var tokenHash = HashToken(request.SecretCode);

        await using var transaction = await _unitOfWork.BeginTransactionAsync();
        try
        {
            // Step 1: find the token by its hash
            var enrollmentToken = await _tokenRepository.FindByHashAsync(tokenHash);

            if (enrollmentToken is null)
                throw new InvalidOperationException("Code d'invitation invalide ou déjà utilisé.");

            // Step 2: validate expiry and usage
            if (enrollmentToken.IsUsed)
                throw new InvalidOperationException("Ce code d'invitation a déjà été utilisé.");

            if (enrollmentToken.ExpiresAt < DateTime.UtcNow)
                throw new InvalidOperationException("Ce code d'invitation a expiré.");

            // Step 3: create the ApplicationUser via Identity, recording the GDPR consent timestamp
            var user = new ApplicationUser
            {
                UserName = request.Email,
                Email = request.Email,
                EmailConfirmed = true,
                FirstName = request.FirstName,
                LastName = request.LastName,
                ConsentGivenAt = DateTimeOffset.UtcNow,
                ConsentVersion = CurrentConsentVersion,
            };

            var identityResult = await _userRepository.CreateAsync(user, request.Password);
            if (!identityResult.Succeeded)
            {
                var errors = string.Join(", ", identityResult.Errors.Select(e => e.Description));
                throw new InvalidOperationException($"La création du compte a échoué : {errors}");
            }

            // Step 4: add user to the patient's CareTeam with the role defined on the token
            var careTeam = new CareTeam
            {
                UserId = user.Id,
                PatientId = enrollmentToken.PatientId,
                Role = enrollmentToken.RoleTarget
            };

            await _careTeamRepository.AddAsync(careTeam);
            // Explicit rather than relying on MarkAsUsedAsync's own SaveChanges to flush this row too
            // (both repositories share the scoped DbContext). Same number of round-trips as before,
            // without the hidden dependency on another repository's internals.
            await _unitOfWork.SaveChangesAsync();

            // Step 5: invalidate the token so it cannot be reused
            await _tokenRepository.MarkAsUsedAsync(enrollmentToken);

            await transaction.CommitAsync();

            // Issue a JWT for the newly created user
            var authResponse = await _authService.LoginAsync(new LoginRequest { Email = request.Email, Password = request.Password });
            return authResponse!;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<InvitationResponse> GenerateInvitationAsync(
        Guid patientId, string roleTarget, string currentUserId)
    {
        // Fetch the membership rather than a boolean: the same row answers both "is a member" and
        // "which role", so authorization costs one query instead of two.
        var membership = await _careTeamRepository.GetForUserAndPatientAsync(currentUserId, patientId)
            ?? throw new UnauthorizedAccessException("You are not a member of this patient's care team.");

        // Server-side enforcement of the rule the UI already expresses (canInvite). Until now this
        // endpoint required care-team membership alone, so any collaborator — teacher, doctor, or a
        // member added as "Other" — could mint a valid code for an arbitrary roleTarget, including one
        // that grants Parent rights. The client-side gate restricted the button, never the endpoint.
        //
        // Parents may invite, and may issue Parent codes in turn: a patient legitimately has two
        // parents, and either can bring collaborators into the dossier.
        if (!CareTeamRoleResolver.IsAdmin(membership) && !CareTeamRoleResolver.IsParent(membership))
            throw new UnauthorizedAccessException(
                "Only the patient's administrator or a parent can issue an invitation.");

        if (!Enum.TryParse<RelationshipType>(roleTarget, ignoreCase: true, out var role))
            throw new ArgumentException($"Rôle cible invalide : '{roleTarget}'.");

        var secretCode = GenerateSecretCode();

        var token = new EnrollmentToken
        {
            Id = Guid.NewGuid(),
            PatientId = patientId,
            TokenHash = HashToken(secretCode),
            RoleTarget = role,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            IsUsed = false
        };

        await _tokenRepository.CreateAsync(token);

        return new InvitationResponse
        {
            PlainSecretCode = secretCode,
            ExpiresAt = token.ExpiresAt
        };
    }

    private static string GenerateSecretCode()
    {
        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        var bytes = new byte[8];
        RandomNumberGenerator.Fill(bytes);
        return new string(bytes.Select(b => chars[b % chars.Length]).ToArray());
    }

    private static string HashToken(string token)
    {
        var hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }
}
