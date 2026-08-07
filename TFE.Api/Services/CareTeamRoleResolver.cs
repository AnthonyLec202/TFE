using TFE.Api.Models;

namespace TFE.Api.Services;

/// <summary>
/// Single source of truth for the coarse role a user holds <i>relative to one patient</i>, derived from
/// their CareTeam membership.
///
/// Deliberately distinct from the global ASP.NET Identity role carried by the session cookie: a user is
/// "Admin" here because they manage <i>this</i> dossier, not because they hold an application-wide role.
/// The two notions must never be conflated — <c>User.IsInRole("Admin")</c> answers a different question
/// than <see cref="IsAdmin"/>.
///
/// Previously duplicated as <c>PatientService.ResolveUserRole</c> and <c>WallService.ResolveRole</c>.
/// The copies agreed on behaviour but had already drifted in shape (one carried a redundant
/// <c>not null</c> arm) — the kind of divergence that silently becomes an authorization difference the
/// next time only one of them is edited.
/// </summary>
public static class CareTeamRoleResolver
{
    /// <summary>
    /// The <c>CustomRoleName</c> stamped on the membership of the psychologist who created the dossier;
    /// it is what marks that membership as the managing one. No other value is ever written to
    /// <c>CustomRoleName</c>, and no code path can assign it after creation.
    /// </summary>
    public const string ManagingPsychologistRoleName = "Neuropsychologue";

    // The three coarse roles. These strings cross the API boundary verbatim (PatientResponse.UserRole,
    // CareTeamMemberResponse.Role) and are mirrored by the frontend's PatientUserRole union — changing
    // one here requires changing frontend/src/types/patient.ts in the same commit.
    public const string Admin = "Admin";
    public const string Parent = "Parent";
    public const string Collaborator = "Collaborator";

    /// <summary>
    /// Resolves a membership to its coarse role.
    ///
    /// A null membership (the user is not on this patient's care team) resolves to
    /// <see cref="Collaborator"/> — the least-privileged value — so a missing row can never widen
    /// access. Callers that must reject a non-member outright check membership separately; this method
    /// answers "which role", never "is a member".
    /// </summary>
    public static string Resolve(CareTeam? careTeam) => careTeam switch
    {
        { CustomRoleName: ManagingPsychologistRoleName } => Admin,
        { Role: RelationshipType.Parent }                => Parent,
        _                                                => Collaborator,
    };

    /// <summary>Whether this membership manages the dossier (the psychologist who created it).</summary>
    public static bool IsAdmin(CareTeam? careTeam) => Resolve(careTeam) == Admin;

    /// <summary>Whether this membership is a parent of the patient.</summary>
    public static bool IsParent(CareTeam? careTeam) => Resolve(careTeam) == Parent;
}
