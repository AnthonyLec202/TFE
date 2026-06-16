using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using TFE.Api.Interfaces.IServices.Encryption;

namespace TFE.Api.Data.Converters;

/// <summary>
/// EF Core ValueConverter that transparently encrypts/decrypts string columns using
/// <see cref="IEncryptionService"/>. Applied to Patient.FirstName, Patient.LastName,
/// SessionNote.ContentText, and Post.Content.
///
/// NULL HANDLING
/// ─────────────
/// EF Core does not invoke a ValueConverter for null model/column values, so a null
/// Post.Content is persisted and read back as null without ever reaching the lambdas.
/// As defense-in-depth, <see cref="IEncryptionService"/> also returns empty/whitespace
/// values untouched, so a blank ContentText round-trips without cryptographic work.
///
/// The lambdas passed to the base constructor contain NO try/catch. A genuine cryptographic
/// failure (tampered ciphertext, wrong key) still propagates and rolls back the transaction —
/// silently returning plaintext on failure would defeat the purpose of the converter.
///
/// Singleton model-cache constraint: EncryptedStringConverter instances are held by the
/// EF Core model cache for the application lifetime. IEncryptionService must therefore
/// be registered as Singleton so the captured reference is never disposed.
/// </summary>
public sealed class EncryptedStringConverter : ValueConverter<string, string>
{
    public EncryptedStringConverter(IEncryptionService encryptionService)
        : base(
            plaintext => encryptionService.Encrypt(plaintext),
            ciphertext => encryptionService.Decrypt(ciphertext))
    {
    }
}
