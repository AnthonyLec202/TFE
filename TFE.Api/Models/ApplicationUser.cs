using Microsoft.AspNetCore.Identity;

namespace TFE.Api.Models;

public class ApplicationUser : IdentityUser
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;

    public virtual ICollection<CareTeam> CareTeamMemberships { get; set; }

    public ApplicationUser()
    {
        CareTeamMemberships = new HashSet<CareTeam>();
    }
}
