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

    // Closed flag plus per-patient attendance. Carried on the update path so closing a session
    // persists server-side through the offline sync cycle.
    public bool IsClosed { get; set; }

    public List<Guid> PatientIds { get; set; } = new();

    public List<SessionAttendanceRequest> Attendances { get; set; } = new();
}
