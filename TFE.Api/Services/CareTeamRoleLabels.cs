using TFE.Api.Models;

namespace TFE.Api.Services;

/// <summary>
/// Single source of the French, human-readable labels shown for a care-team membership.
///
/// Strictly presentation. The counterpart <see cref="CareTeamRoleResolver"/> answers the
/// authorization question ("what may this member do"); this class answers only "what do we call them".
/// Never branch on a value returned here — the labels are free to change with the copy, the resolver's
/// values are an API contract.
///
/// Previously duplicated as <c>WallService.LabelForCareTeam</c> (French labels, wall feed) and
/// <c>PatientService.ResolveRelationshipLabel</c> (raw enum names, care-team modal). The two disagreed
/// on both language and precedence, which is why the same person read "Neuropsychologue" in one screen
/// and "Psychologue" in the other.
/// </summary>
public static class CareTeamRoleLabels
{
    /// <summary>Label for the psychologist managing the dossier. Unified across every screen.</summary>
    public const string ManagingPsychologist = "Psychologue";

    /// <summary>Fallback when no membership is available (e.g. the author's account was deleted).</summary>
    public const string UnknownCollaborator = "Collaborateur";

    /// <summary>
    /// Labels a membership.
    ///
    /// Precedence: the managing marker first, then any other explicit CustomRoleName, then the
    /// relationship type. The two merged implementations disagreed here — the wall let the enum win
    /// over a custom name, the care-team modal let the custom name win. An explicit custom name is an
    /// intentional override, so it takes priority. The distinction is currently unobservable:
    /// "Neuropsychologue" is the only value ever written to CustomRoleName.
    /// </summary>
    public static string ForCareTeam(CareTeam? careTeam) => careTeam switch
    {
        { CustomRoleName: CareTeamRoleResolver.ManagingPsychologistRoleName } => ManagingPsychologist,
        { CustomRoleName: { Length: > 0 } customName }                        => customName,
        not null                                                              => ForRelationship(careTeam.Role),
        _                                                                     => UnknownCollaborator,
    };

    /// <summary>
    /// Labels a relationship type on its own. Every <see cref="RelationshipType"/> member is mapped —
    /// adding a member to the enum without adding it here falls through to
    /// <see cref="UnknownCollaborator"/> rather than leaking the English identifier.
    /// </summary>
    public static string ForRelationship(RelationshipType role) => role switch
    {
        RelationshipType.Parent               => "Parent",
        RelationshipType.Teacher              => "Enseignant(e)",
        RelationshipType.SpeechTherapist      => "Logopède",
        RelationshipType.PsychomotorTherapist => "Psychomotricien(ne)",
        RelationshipType.Ergotherapist        => "Ergothérapeute",
        RelationshipType.Doctor               => "Docteur",
        RelationshipType.Other                => "Autre",
        _                                     => UnknownCollaborator,
    };
}
