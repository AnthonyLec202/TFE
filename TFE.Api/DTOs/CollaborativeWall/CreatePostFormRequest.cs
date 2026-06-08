using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace TFE.Api.DTOs.CollaborativeWall;

/// <summary>
/// Multipart/form-data variant of the post creation request.
/// Use with [FromForm] on the controller action.
/// Content is optional: a post may consist of attachments only.
/// The service layer enforces the rule that at least one of Content or Attachments must be present.
/// File validation (size, MIME type) is enforced in the service layer.
/// </summary>
public class CreatePostFormRequest
{
    [StringLength(5000, ErrorMessage = "Content must be at most 5000 characters.")]
    public string? Content { get; set; }

    // Admin only: array of RelationshipType string values to exclude from visibility.
    // Sent as repeated form fields: ExcludedRoles=Teacher&ExcludedRoles=Doctor
    public string[] ExcludedRoles { get; set; } = Array.Empty<string>();

    // Optional file attachments. Validation constraints (max size: 10 MB,
    // allowed MIME types) are enforced in the service layer to keep validation logic centralized.
    public List<IFormFile>? Attachments { get; set; }
}
