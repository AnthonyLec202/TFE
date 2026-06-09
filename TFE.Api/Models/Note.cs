namespace TFE.Api.Models;

public class Note
{
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime LastModifiedAt { get; set; }

    public virtual Session? Session { get; set; }
}
