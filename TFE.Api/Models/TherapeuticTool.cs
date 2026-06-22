namespace TFE.Api.Models;

/// <summary>
/// A reusable clinical instrument curated by the practitioner (the "Matériauthèque"). Beyond its
/// descriptive metadata it carries the adaptive scaffolding (down/up-grading strategies) that lets
/// the clinician titrate the intervention to the patient's tolerance during an active session, and
/// links to the therapy sessions in which it was deployed (many-to-many).
/// </summary>
public class TherapeuticTool
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;

    // Type and Theme are free-form categories rather than fixed enums: the clinician curates the
    // taxonomy on the fly. They stay indexed (see ApplicationDbContext) so the catalog still filters
    // on them efficiently, and the client suggests existing values via a creatable combobox.
    public string Type { get; set; } = string.Empty;
    public string Theme { get; set; } = string.Empty;

    // Clinical scaffolding / adaptive properties.
    // DownGradingStrategy: how to lower the exposure/cognitive load when the patient is overwhelmed.
    // UpGradingStrategy: how to increase the challenge once the current level is mastered.
    public string DownGradingStrategy { get; set; } = string.Empty;
    public string UpGradingStrategy { get; set; } = string.Empty;

    // EF Core navigation property for the many-to-many relationship with Session.
    public virtual ICollection<Session> Sessions { get; set; } = new List<Session>();
}
