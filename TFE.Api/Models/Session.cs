namespace TFE.Api.Models;

public class Session
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    public string Time { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;

    // Owner of the session (the admin who created it). Nullable so existing rows migrate cleanly and
    // so a draft "patient-less" session is still reachable by its creator's user-scoped read.
    public string? CreatedById { get; set; }

    // Open sessions appear on the general dashboard; once closed the session is archived to the
    // participating patients' clinical history. Per-patient attendance lives in Attendances.
    public bool IsClosed { get; set; }

    // AI-generated clinical report (Markdown). Nullable until a report is generated. Clinical content,
    // so it is encrypted at rest by the EncryptedStringConverter (see ApplicationDbContext).
    public string? AiReport { get; set; }

    // True once the clinician has reviewed, corrected, and validated the AI report under their
    // professional responsibility. Defaults to false (a freshly generated draft is unvalidated).
    public bool IsReportValidated { get; set; }

    public virtual ICollection<Patient> Patients { get; set; } = new List<Patient>();
    public virtual ICollection<SessionAttendance> Attendances { get; set; } = new List<SessionAttendance>();
    public virtual ICollection<SessionNote> SessionNotes { get; set; } = new HashSet<SessionNote>();

    // Therapeutic tools deployed during this session (many-to-many with TherapeuticTool).
    public virtual ICollection<TherapeuticTool> TherapeuticTools { get; set; } = new List<TherapeuticTool>();

    public Note? Note { get; set; }
}
