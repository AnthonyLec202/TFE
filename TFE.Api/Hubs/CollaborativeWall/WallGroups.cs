namespace TFE.Api.Hubs.CollaborativeWall;

/// <summary>
/// Naming of the SignalR groups backing a patient's collaborative wall.
///
/// A wall group is keyed by the patient AND by the role the connected member holds on that dossier,
/// rather than by the patient alone. This is what makes the per-post role exclusion
/// (<see cref="TFE.Api.Models.Post.ExcludedRoles"/>) hold on the real-time channel: an excluded role
/// is never addressed by the fan-out, so the content never reaches its connection. Keying by patient
/// alone put the whole care team on one group, and every listener received every post — the HTTP read
/// filtered correctly while the broadcast handed the same content to the very roles it excluded.
/// </summary>
public static class WallGroups
{
    /// <summary>
    /// Segment for the psychologist managing the dossier. Held apart from the relationship roles
    /// because the manager reads every post regardless of its exclusion set (see
    /// <c>WallService.GetWallAsync</c>), and must therefore never be filtered out of a fan-out.
    /// </summary>
    public const string AdminSegment = "Admin";

    /// <summary>Builds the group name for one patient and one role segment.</summary>
    public static string For(Guid patientId, string roleSegment) => $"wall:{patientId}:{roleSegment}";
}
