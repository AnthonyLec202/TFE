namespace TFE.Api.DTOs.CollaborativeWall;

public class PostResponse
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public string Content { get; set; } = string.Empty;
    public string[] ExcludedRoles { get; set; } = Array.Empty<string>();
    public string? CreatedById { get; set; }
    public string AuthorFirstName { get; set; } = string.Empty;
    public string AuthorLastName { get; set; } = string.Empty;
    public string AuthorRole { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public List<CommentResponse> Comments { get; set; } = new();
    public List<AttachmentResponse> Attachments { get; set; } = new();
}
