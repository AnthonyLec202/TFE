using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace TFE.Api.Hubs.CollaborativeWall;

// Purely online, real-time transport for the collaborative wall and global notifications. Holds
// no offline/Dexie state — it only relays freshly persisted posts and notifications to connected
// clients.
[Authorize]
public class CollaborativeWallHub : Hub<ICollaborativeWallClient>
{
    // Every authenticated connection joins a personal group keyed by its user id, so the
    // notification bell can be reached via Clients.Group(userId) regardless of which page
    // the user is currently viewing.
    public override async Task OnConnectedAsync()
    {
        if (Context.UserIdentifier is not null)
            await Groups.AddToGroupAsync(Context.ConnectionId, Context.UserIdentifier);

        await base.OnConnectedAsync();
    }

    // Isolates broadcasts per patient wall: clients join the group for the wall they are viewing
    // so a new post is only pushed to other connections currently looking at that same wall.
    public async Task JoinWallGroup(string patientId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, patientId);
    }
}
