namespace TFE.Api.Models;

public class Session
{
    public Guid Id { get; set; }

    public Guid PatientId { get; set; }
    public virtual Patient Patient { get; set; } = null!;

    public DateTime Date { get; set; }
    public string Type { get; set; } = string.Empty;

    public virtual ICollection<SessionNote> SessionNotes { get; set; }

    public Session()
    {
        SessionNotes = new HashSet<SessionNote>();
    }
}
