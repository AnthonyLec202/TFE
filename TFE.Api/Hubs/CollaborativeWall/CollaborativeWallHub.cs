using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using TFE.Api.Interfaces.IServices.CollaborativeWall;

namespace TFE.Api.Hubs.CollaborativeWall;

// Purely online, real-time transport for the collaborative wall and global notifications. Holds
// no offline/Dexie state — it only relays freshly persisted posts and notifications to connected
// clients.
[Authorize]
public class CollaborativeWallHub : Hub<ICollaborativeWallClient>
{
    private readonly IWallService _wallService;

    public CollaborativeWallHub(IWallService wallService)
    {
        _wallService = wallService;
    }

    // Every authenticated connection joins a personal group keyed by its user id, so the
    // notification bell can be reached via Clients.Group(userId) regardless of which page
    // the user is currently viewing.
    public override async Task OnConnectedAsync()
    {
        if (Context.UserIdentifier is not null)
            await Groups.AddToGroupAsync(Context.ConnectionId, Context.UserIdentifier);

        await base.OnConnectedAsync();
    }

    // Subscribes this connection to the wall of a patient it is entitled to read.
    //
    // Two guarantees are established here, and neither may be relaxed to the client:
    //  1. Membership is verified server-side. The caller only supplies a patient id, so without this
    //     check any authenticated user knowing (or guessing) a GUID could subscribe to a dossier they
    //     have no relationship with and receive its whole live feed.
    //  2. The group joined is scoped to the role the caller holds on THIS dossier, resolved by the
    //     service. The fan-out then addresses only the role segments a post is visible to, so an
    //     excluded role is filtered before the content is written to the wire — not after, in the UI.
    public async Task JoinWallGroup(string patientId)
    {
        if (Context.UserIdentifier is null)
            throw new HubException("Unauthenticated connection.");

        if (!Guid.TryParse(patientId, out var parsedPatientId))
            throw new HubException("Invalid patient identifier.");

        var group = await _wallService.ResolveWallGroupAsync(Context.UserIdentifier, parsedPatientId)
            ?? throw new HubException("Not a member of this patient's care team.");

        await Groups.AddToGroupAsync(Context.ConnectionId, group);
    }
}
