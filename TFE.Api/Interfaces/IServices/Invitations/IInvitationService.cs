namespace TFE.Api.Interfaces.IServices.Invitations;

public interface IInvitationService
{
    /// <summary>
    /// Adds an already-authenticated user to a patient's care team using an invitation code.
    /// </summary>
    Task JoinPatientAsync(string userId, string secretCode);
}
