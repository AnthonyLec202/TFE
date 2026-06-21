using System.ComponentModel.DataAnnotations;
using TFE.Api.Models;

namespace TFE.Api.DTOs.ClinicalTools;

/// <summary>
/// Outbound projection of a <see cref="TherapeuticTool"/>. The enums are serialized as their integer
/// values so the local-first client can store and index them directly in IndexedDB.
/// </summary>
public class TherapeuticToolResponse
{
    [Required] public Guid Id { get; set; }
    [Required] public string Title { get; set; } = string.Empty;
    [Required] public string Description { get; set; } = string.Empty;
    [Required] public ToolType Type { get; set; }
    [Required] public CbtTheme Theme { get; set; }
    [Required] public string DownGradingStrategy { get; set; } = string.Empty;
    [Required] public string UpGradingStrategy { get; set; } = string.Empty;
}
