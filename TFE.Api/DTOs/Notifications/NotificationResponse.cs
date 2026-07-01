namespace TFE.Api.DTOs.Notifications;

public class NotificationResponse
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    /// <summary>Serialised from <see cref="Models.NotificationType"/> — string value, e.g. "NewPost".</summary>
    public string Type { get; set; } = string.Empty;
    public string ActorFirstName { get; set; } = string.Empty;
    public string ActorLastName { get; set; } = string.Empty;
    // Identifies the patient dossier the notification relates to, so the client can render
    // "… dans le dossier de {PatientFirstName} {PatientLastName[0]}.". Recipients are always members
    // of the patient's care team, so this discloses nothing they cannot already access.
    public string PatientFirstName { get; set; } = string.Empty;
    public string PatientLastName { get; set; } = string.Empty;
    public bool IsRead { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public string? TargetUrl { get; set; }
}
