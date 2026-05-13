using System.ComponentModel.DataAnnotations;

namespace TFE.Api.DTOs;

public class CreatePostRequest
{
    [Required(ErrorMessage = "Content is required.")]
    [StringLength(5000, MinimumLength = 1, ErrorMessage = "Content must be between 1 and 5000 characters.")]
    public string Content { get; set; } = string.Empty;

    // Admin only: array of RelationshipType string values to exclude from visibility
    public string[] ExcludedRoles { get; set; } = Array.Empty<string>();
}
