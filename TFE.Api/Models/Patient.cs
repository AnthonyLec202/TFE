namespace TFE.Api.Models;

public class Patient
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public DateOnly BirthDate { get; set; }
    public DateTime CreatedAt { get; set; }

    // Optional contact details, captured/edited from the patient dossier (never at creation).
    // Nullable so existing rows migrate cleanly; encrypted at rest like the other PII columns.
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public string? PostalAddress { get; set; }

    // Archived patients are hidden from the active "Mes patients" list and surfaced in the Archives
    // view. Defaults to false so existing rows and new patients start active.
    public bool IsArchived { get; set; }

    public virtual ICollection<EnrollmentToken> EnrollmentTokens { get; set; }
    public virtual ICollection<CareTeam> CareTeam { get; set; }
    public virtual ICollection<Post> Posts { get; set; }
    public virtual ICollection<Session> Sessions { get; set; }

    public Patient()
    {
        EnrollmentTokens = new HashSet<EnrollmentToken>();
        CareTeam = new HashSet<CareTeam>();
        Posts = new HashSet<Post>();
        Sessions = new HashSet<Session>();
    }
}
