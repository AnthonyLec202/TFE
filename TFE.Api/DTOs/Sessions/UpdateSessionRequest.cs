using System.ComponentModel.DataAnnotations;

namespace TFE.Api.DTOs.Sessions;

public class UpdateSessionRequest
{
    [Required]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string Date { get; set; } = string.Empty;

    [Required]
    public string Time { get; set; } = string.Empty;

    public List<Guid> PatientIds { get; set; } = new();
}
