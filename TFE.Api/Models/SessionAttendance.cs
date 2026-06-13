namespace TFE.Api.Models;

// Junction between a Session and a Patient carrying that patient's individual attendance outcome.
// A session (e.g. group therapy) owns one SessionAttendance per participating patient.
public class SessionAttendance
{
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    public Guid PatientId { get; set; }
    public SessionStatus Status { get; set; }

    public virtual Session Session { get; set; } = null!;
}
