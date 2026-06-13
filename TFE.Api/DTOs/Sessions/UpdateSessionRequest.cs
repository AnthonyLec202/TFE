using System.ComponentModel.DataAnnotations;
using TFE.Api.Models;

namespace TFE.Api.DTOs.Sessions;

public class UpdateSessionRequest
{
    [Required]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string Date { get; set; } = string.Empty;

    [Required]
    public string Time { get; set; } = string.Empty;

    // Attendance status. Carried on the update path so marking a session's attendance
    // persists server-side through the offline sync cycle.
    public SessionStatus Status { get; set; }

    public List<Guid> PatientIds { get; set; } = new();
}
