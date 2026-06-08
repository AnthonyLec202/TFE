using System.Security.Cryptography;
using System.Text;
using TFE.Api.Data;
using TFE.Api.DTOs.Auth;
using TFE.Api.DTOs.Invitations;
using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Interfaces.IServices.Auth;
using TFE.Api.Models;

namespace TFE.Api.Services.Auth;

public class EnrollmentService : IEnrollmentService
{
    private readonly ApplicationDbContext _context;
    private readonly IEnrollmentTokenRepository _tokenRepository;
    private readonly ICareTeamRepository _careTeamRepository;
    private readonly IUserRepository _userRepository;
    private readonly IAuthService _authService;

    public EnrollmentService(
        ApplicationDbContext context,
        IEnrollmentTokenRepository tokenRepository,
        ICareTeamRepository careTeamRepository,
        IUserRepository userRepository,
        IAuthService authService)
    {
        _context = context;
        _tokenRepository = tokenRepository;
        _careTeamRepository = careTeamRepository;
        _userRepository = userRepository;
        _authService = authService;
    }

    public async Task<AuthResponse> ConsumeTokenAsync(ConsumeTokenRequest request)
    {
        var tokenHash = HashToken(request.SecretCode);

        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            // Step 1: find the token by its hash
            var enrollmentToken = await _tokenRepository.FindByHashAsync(tokenHash);

            if (enrollmentToken is null)
                throw new InvalidOperationException("Invalid or already used invitation code.");

            // Step 2: validate expiry and usage
            if (enrollmentToken.IsUsed)
                throw new InvalidOperationException("This invitation code has already been used.");

            if (enrollmentToken.ExpiresAt < DateTime.UtcNow)
                throw new InvalidOperationException("This invitation code has expired.");

            // Step 3: create the ApplicationUser via Identity
            var user = new ApplicationUser
            {
                UserName = request.Email,
                Email = request.Email,
                EmailConfirmed = true,
                FirstName = request.FirstName,
                LastName = request.LastName
            };

            var identityResult = await _userRepository.CreateAsync(user, request.Password);
            if (!identityResult.Succeeded)
            {
                var errors = string.Join(", ", identityResult.Errors.Select(e => e.Description));
                throw new InvalidOperationException($"Account creation failed: {errors}");
            }

            // Step 4: add user to the patient's CareTeam with the role defined on the token
            var careTeam = new CareTeam
            {
                UserId = user.Id,
                PatientId = enrollmentToken.PatientId,
                Role = enrollmentToken.RoleTarget
            };

            await _careTeamRepository.CreateAsync(careTeam);

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
        if (!await _careTeamRepository.IsUserInCareTeamAsync(currentUserId, patientId))
            throw new UnauthorizedAccessException("You are not a member of this patient's care team.");

        if (!Enum.TryParse<RelationshipType>(roleTarget, ignoreCase: true, out var role))
            throw new ArgumentException($"Invalid role target: '{roleTarget}'.");

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
