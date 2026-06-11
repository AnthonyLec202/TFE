using System.ComponentModel.DataAnnotations;

namespace TFE.Api.DTOs.Sessions;

public class UpdateSessionRequest
{
    [Required]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string Date { get; set; } = string.Empty;

    [Required]
    public string Time { get; set; } = string.Empty;

    // Whether the session is archived to the patient's history. Carried on the update path
    // so marking a session completed persists server-side through the offline sync cycle.
    public bool IsCompleted { get; set; }

    public List<Guid> PatientIds { get; set; } = new();
}
