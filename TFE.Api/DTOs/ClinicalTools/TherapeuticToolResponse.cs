using System.ComponentModel.DataAnnotations;

namespace TFE.Api.DTOs.ClinicalTools;

/// <summary>
/// Outbound projection of a <see cref="TFE.Api.Models.TherapeuticTool"/>. Type and Theme are free-form
/// category strings the local-first client stores and indexes directly in IndexedDB.
/// </summary>
public class TherapeuticToolResponse
{
    [Required] public Guid Id { get; set; }
    [Required] public string Title { get; set; } = string.Empty;
    [Required] public string Description { get; set; } = string.Empty;
    [Required] public string Type { get; set; } = string.Empty;
    [Required] public string Theme { get; set; } = string.Empty;
    [Required] public string DownGradingStrategy { get; set; } = string.Empty;
    [Required] public string UpGradingStrategy { get; set; } = string.Empty;
}
