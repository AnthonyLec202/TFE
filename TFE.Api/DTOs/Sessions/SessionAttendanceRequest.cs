using TFE.Api.Models;

namespace TFE.Api.DTOs.Sessions;

// One patient's attendance outcome within a session, carried on the sync/update paths.
public class SessionAttendanceRequest
{
    public Guid PatientId { get; set; }
    public SessionStatus Status { get; set; }
}
