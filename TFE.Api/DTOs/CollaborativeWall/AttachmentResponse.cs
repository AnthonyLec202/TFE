namespace TFE.Api.DTOs.CollaborativeWall;

public class AttachmentResponse
{
    public Guid Id { get; set; }
    public string FileUrl { get; set; } = string.Empty;
    public string Filename { get; set; } = string.Empty;
    public string Filetype { get; set; } = string.Empty;
    public Guid? PostId { get; set; }
    public Guid? CommentId { get; set; }
    public DateTime CreatedAt { get; set; }
}
