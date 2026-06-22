using System.ComponentModel.DataAnnotations;

namespace TFE.Api.DTOs.ClinicalTools;

/// <summary>
/// Inbound payload to edit an existing tool. The id is carried in the route, not the body. Sent by
/// the detail page's debounced auto-save with the full current field set.
/// </summary>
public class UpdateTherapeuticToolRequest
{
    [Required, MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string Type { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string Theme { get; set; } = string.Empty;

    public string DownGradingStrategy { get; set; } = string.Empty;

    public string UpGradingStrategy { get; set; } = string.Empty;
}
