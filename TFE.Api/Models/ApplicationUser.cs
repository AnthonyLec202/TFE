using Microsoft.AspNetCore.Identity;

namespace TFE.Api.Models;

public class ApplicationUser : IdentityUser
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;

    // GDPR consent trace (Art. 7): UTC timestamp at which the user accepted data collection
    // during enrollment. Null means no consent has been recorded.
    public DateTimeOffset? ConsentGivenAt { get; set; }

    // Identifies which version of the privacy policy / terms the user accepted at enrollment.
    public string? ConsentVersion { get; set; }

    public virtual ICollection<CareTeam> CareTeamMemberships { get; set; }

    public ApplicationUser()
    {
        CareTeamMemberships = new HashSet<CareTeam>();
    }
}
