using TFE.Api.Models;

namespace TFE.Api.DTOs.Sessions;

public class SyncSessionRequest
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    public string Time { get; set; } = string.Empty;
    public bool IsClosed { get; set; }

    // AI report carried on the sync/create path so a validated report persists server-side.
    public string? AiReport { get; set; }
    public bool IsReportValidated { get; set; }

    public List<Guid> PatientIds { get; set; } = new();
    public List<Guid> ToolIds { get; set; } = new();
    public List<SessionAttendanceRequest> Attendances { get; set; } = new();
}
