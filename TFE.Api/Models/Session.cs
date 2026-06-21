namespace TFE.Api.Models;

public class Session
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    public string Time { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;

    // Open sessions appear on the general dashboard; once closed the session is archived to the
    // participating patients' clinical history. Per-patient attendance lives in Attendances.
    public bool IsClosed { get; set; }

    public virtual ICollection<Patient> Patients { get; set; } = new List<Patient>();
    public virtual ICollection<SessionAttendance> Attendances { get; set; } = new List<SessionAttendance>();
    public virtual ICollection<SessionNote> SessionNotes { get; set; } = new HashSet<SessionNote>();

    // Therapeutic tools deployed during this session (many-to-many with TherapeuticTool).
    public virtual ICollection<TherapeuticTool> TherapeuticTools { get; set; } = new List<TherapeuticTool>();

    public Note? Note { get; set; }
}
