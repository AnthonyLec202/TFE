using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;

namespace TFE.Api.Hubs;

// SignalR's default IUserIdProvider reads ClaimTypes.NameIdentifier, but our JWTs carry the user
// id in the standard "sub" claim without that mapping applied. This mirrors the CurrentUserId
// fallback used by the controllers (NameIdentifier, then "sub"), so Context.UserIdentifier
// matches the id used to key CareTeam/Notification records.
public class NameIdentifierUserIdProvider : IUserIdProvider
{
    public string? GetUserId(HubConnectionContext connection)
        => connection.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
           ?? connection.User.FindFirst("sub")?.Value;
}
