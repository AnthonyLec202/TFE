using System.ComponentModel.DataAnnotations;
using TFE.Api.Models;

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
