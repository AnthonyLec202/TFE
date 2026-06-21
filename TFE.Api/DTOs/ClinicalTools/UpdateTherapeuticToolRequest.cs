using System.ComponentModel.DataAnnotations;
using TFE.Api.Models;

namespace TFE.Api.DTOs.ClinicalTools;

/// <summary>
/// Inbound payload to edit an existing tool. The id is carried in the route, not the body.
/// </summary>
public class UpdateTherapeuticToolRequest
{
    [Required, MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string Description { get; set; } = string.Empty;

    [Required, EnumDataType(typeof(ToolType))]
    public ToolType Type { get; set; }

    [Required, EnumDataType(typeof(CbtTheme))]
    public CbtTheme Theme { get; set; }

    [Required]
    public string DownGradingStrategy { get; set; } = string.Empty;

    [Required]
    public string UpGradingStrategy { get; set; } = string.Empty;
}
