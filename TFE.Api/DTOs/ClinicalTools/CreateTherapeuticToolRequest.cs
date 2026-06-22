using System.ComponentModel.DataAnnotations;

namespace TFE.Api.DTOs.ClinicalTools;

/// <summary>
/// Inbound payload to add a new tool to the practitioner's library. The optional client-generated
/// <see cref="Id"/> lets an offline creation keep a stable identity that survives the sync push.
/// </summary>
public class CreateTherapeuticToolRequest
{
    public Guid? Id { get; set; }

    [Required, MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    // Description and the grading strategies are authored on the detail page (auto-saved), so they
    // are optional at creation time — the inline form only captures Title, Type and Theme.
    public string Description { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string Type { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string Theme { get; set; } = string.Empty;

    public string DownGradingStrategy { get; set; } = string.Empty;

    public string UpGradingStrategy { get; set; } = string.Empty;
}
