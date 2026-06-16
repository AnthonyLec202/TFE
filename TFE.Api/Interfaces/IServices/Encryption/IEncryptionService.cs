namespace TFE.Api.Interfaces.IServices.Encryption;

public interface IEncryptionService
{
    /// <summary>
    /// Encrypts a plaintext string. Returns a sentinel-prefixed Base64 blob.
    /// Throws <see cref="InvalidOperationException"/> if the key is missing or the operation fails.
    /// </summary>
    string Encrypt(string plaintext);

    /// <summary>
    /// Decrypts a blob produced by <see cref="Encrypt"/>.
    /// If the value does not start with the sentinel prefix it is returned as-is
    /// (graceful migration of legacy plaintext records).
    /// Throws <see cref="InvalidOperationException"/> if authentication or decryption fails.
    /// </summary>
    string Decrypt(string ciphertext);
}
