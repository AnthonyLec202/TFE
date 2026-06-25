using TFE.Api.Models;

namespace TFE.Api.DTOs.Sessions;

/// <summary>
/// A session returned to the offline-first client for cross-device hydration. <see cref="Title"/> is
/// already decrypted: the EncryptedStringConverter strips the <c>$penc$</c> sentinel on materialization.
/// Mirrors the client's local session shape so the reconciler can persist it directly.
/// </summary>
public class SessionResponse
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    public string Time { get; set; } = string.Empty;
    public bool IsClosed { get; set; }

    // AI report fields, decrypted on materialization like Title. Null until a report exists.
    public string? AiReport { get; set; }
    public bool IsReportValidated { get; set; }

    public List<Guid> PatientIds { get; set; } = new();
    public List<Guid> ToolIds { get; set; } = new();
    public List<SessionAttendanceResponse> Attendances { get; set; } = new();
}

/// <summary>One participating patient's attendance outcome within a session.</summary>
public class SessionAttendanceResponse
{
    public Guid PatientId { get; set; }
    public SessionStatus Status { get; set; }
}
