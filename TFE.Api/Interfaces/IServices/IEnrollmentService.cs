using TFE.Api.DTOs;

namespace TFE.Api.Interfaces.IServices;

public interface IEnrollmentService
{
    Task<AuthResponse> ConsumeTokenAsync(ConsumeTokenRequest request);
    Task<InvitationResponse> GenerateInvitationAsync(Guid patientId, string roleTarget, string currentUserId);
}
