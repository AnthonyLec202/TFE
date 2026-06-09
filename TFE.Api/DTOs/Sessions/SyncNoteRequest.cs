namespace TFE.Api.DTOs.Sessions;

public class SyncNoteRequest
{
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime LastModifiedAt { get; set; }
}
