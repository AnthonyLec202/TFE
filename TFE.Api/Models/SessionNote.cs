namespace TFE.Api.Models;

public class SessionNote : AuditableEntity
{
    public Guid SessionId { get; set; }
    public virtual Session Session { get; set; } = null!;

    public string ContentText { get; set; } = string.Empty;

    // Stores raw handwriting stroke coordinates (JSON) captured from PointerEvents.
    public string? RawData { get; set; }

    public bool IsPublished { get; set; }
}
