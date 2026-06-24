namespace TFE.Api.DTOs.Sessions;

/// <summary>
/// A session note returned to the offline-first client for cross-device hydration.
/// <see cref="Content"/> is already decrypted: the EncryptedStringConverter strips the
/// <c>$penc$</c> sentinel and returns plaintext when EF Core materializes the entity, so the
/// client never sees ciphertext.
/// </summary>
public class NoteResponse
{
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime LastModifiedAt { get; set; }
}
