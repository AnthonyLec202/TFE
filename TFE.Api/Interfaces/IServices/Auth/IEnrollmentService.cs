using TFE.Api.DTOs.Auth;
using TFE.Api.DTOs.Invitations;

namespace TFE.Api.Interfaces.IServices.Auth;

public interface IEnrollmentService
{
    Task<AuthResponse> ConsumeTokenAsync(ConsumeTokenRequest request);

    /// <summary>
    /// Issues a single-use invitation code for a patient's care team.
    /// </summary>
    /// <exception cref="UnauthorizedAccessException">
    /// The caller is not on the patient's care team, or holds a role other than administrator or
    /// parent. Enforced in the service, not by a controller attribute: the rule depends on the
    /// caller's CareTeam membership for <paramref name="patientId"/>, not on a global Identity role.
    /// </exception>
    /// <exception cref="ArgumentException">
    /// <paramref name="roleTarget"/> does not name a <c>RelationshipType</c>.
    /// </exception>
    Task<InvitationResponse> GenerateInvitationAsync(Guid patientId, string roleTarget, string currentUserId);
}
