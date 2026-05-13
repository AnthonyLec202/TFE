namespace TFE.Api.Models;

public class Patient
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public DateOnly BirthDate { get; set; }
    public DateTime CreatedAt { get; set; }

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
