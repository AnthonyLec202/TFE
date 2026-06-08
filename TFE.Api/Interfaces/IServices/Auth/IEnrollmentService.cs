using TFE.Api.DTOs.Auth;
using TFE.Api.DTOs.Invitations;

namespace TFE.Api.Interfaces.IServices.Auth;

public interface IEnrollmentService
{
    Task<AuthResponse> ConsumeTokenAsync(ConsumeTokenRequest request);
    Task<InvitationResponse> GenerateInvitationAsync(Guid patientId, string roleTarget, string currentUserId);
}
