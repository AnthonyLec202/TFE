using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace TFE.Api.DTOs.CollaborativeWall;

/// <summary>
/// Multipart/form-data variant of the comment creation request.
/// Use with [FromForm] on the controller action.
/// Content is optional: a comment may consist of attachments only.
/// The service layer enforces the rule that at least one of Content or Attachments must be present.
/// </summary>
public class CreateCommentFormRequest
{
    [StringLength(5000, ErrorMessage = "Content must be at most 5000 characters.")]
    public string? Content { get; set; }

    public List<IFormFile>? Attachments { get; set; }
}
