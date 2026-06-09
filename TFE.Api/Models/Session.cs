namespace TFE.Api.Models;

public class Session
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    public string Time { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;

    public virtual ICollection<Patient> Patients { get; set; } = new List<Patient>();
    public virtual ICollection<SessionNote> SessionNotes { get; set; } = new HashSet<SessionNote>();
    public Note? Note { get; set; }
}
