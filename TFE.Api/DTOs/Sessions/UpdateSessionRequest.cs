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

    // AI report carried on the update path so a validated/edited report persists server-side
    // through the offline sync cycle.
    public string? AiReport { get; set; }
    public bool IsReportValidated { get; set; }

    public List<Guid> PatientIds { get; set; } = new();

    // Therapeutic tools associated to this session (many-to-many). Carried on the update path so a
    // tool association made during an active session persists server-side through the sync cycle.
    public List<Guid> ToolIds { get; set; } = new();

    public List<SessionAttendanceRequest> Attendances { get; set; } = new();
}
