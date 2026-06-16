using System.Security.Cryptography;
using System.Text;
using TFE.Api.Interfaces.IServices.Encryption;

namespace TFE.Api.Services.Encryption;

/// <summary>
/// AES-256-CBC + HMAC-SHA256 field-level encryption for PII columns (GDPR Art. 32 / F-01).
///
/// KEY DERIVATION
/// ──────────────
/// A single base key is read from configuration ("Encryption:PiiKey", Base64-encoded).
/// Two independent 32-byte sub-keys are derived via HKDF-SHA256:
///   - AES encryption key (purpose label: "patient-pii-aes")
///   - HMAC authentication key (purpose label: "patient-pii-mac")
///
/// WIRE FORMAT
/// ───────────
/// Encrypt() returns: SENTINEL + Base64( IV[16] ‖ MAC[32] ‖ AES-CBC ciphertext )
/// Decrypt() verifies the MAC before attempting decryption (Encrypt-then-MAC).
/// Both methods return null/empty/whitespace values untouched. If a non-blank value does not
/// start with SENTINEL, Decrypt() returns it as-is (legacy plaintext, zero-downtime migration).
///
/// SINGLETON LIFETIME
/// ──────────────────
/// This service must be registered as Singleton. EF Core caches the model (and the
/// EncryptedStringConverter that captures this service) for the application lifetime.
/// A Scoped registration would be disposed while the model persists.
/// </summary>
public sealed class EncryptionService : IEncryptionService
{
    private const string Sentinel = "$penc$";
    private const int IvByteLength = 16;
    private const int MacByteLength = 32;

    private readonly byte[] _aesKey;
    private readonly byte[] _macKey;

    public EncryptionService(IConfiguration configuration)
    {
        var rawBase64 = configuration["Encryption:PiiKey"]
            ?? throw new InvalidOperationException(
                "Encryption:PiiKey is not configured. " +
                "Provide a Base64-encoded secret key in appsettings or environment variables.");

        byte[] baseKey;
        try
        {
            baseKey = Convert.FromBase64String(rawBase64);
        }
        catch (FormatException ex)
        {
            throw new InvalidOperationException(
                "Encryption:PiiKey is not valid Base64.", ex);
        }

        if (baseKey.Length < 16)
            throw new InvalidOperationException(
                "Encryption:PiiKey must decode to at least 16 bytes (128 bits). " +
                "Use a minimum of 32 bytes (256 bits) for production.");

        _aesKey = HKDF.DeriveKey(HashAlgorithmName.SHA256, baseKey, 32,
            info: Encoding.UTF8.GetBytes("patient-pii-aes"));
        _macKey = HKDF.DeriveKey(HashAlgorithmName.SHA256, baseKey, 32,
            info: Encoding.UTF8.GetBytes("patient-pii-mac"));
    }

    public string Encrypt(string plaintext)
    {
        // Null, empty, or whitespace-only values carry no sensitive content. Returning them
        // as-is keeps the round-trip symmetric with Decrypt (which treats sentinel-less values
        // as plaintext) and avoids emitting needless ciphertext for blank clinical fields.
        if (string.IsNullOrWhiteSpace(plaintext))
            return plaintext;

        using var aes = Aes.Create();
        aes.KeySize = 256;
        aes.Key = _aesKey;
        aes.Mode = CipherMode.CBC;
        aes.Padding = PaddingMode.PKCS7;
        aes.GenerateIV();

        byte[] ciphertextBytes;
        using (var encryptor = aes.CreateEncryptor())
        using (var ms = new MemoryStream())
        {
            using (var cs = new CryptoStream(ms, encryptor, CryptoStreamMode.Write))
            {
                var plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
                cs.Write(plaintextBytes, 0, plaintextBytes.Length);
                cs.FlushFinalBlock();
            }
            ciphertextBytes = ms.ToArray();
        }

        // Encrypt-then-MAC: MAC covers IV ‖ ciphertext to prevent IV tampering.
        var dataToMac = new byte[IvByteLength + ciphertextBytes.Length];
        Buffer.BlockCopy(aes.IV, 0, dataToMac, 0, IvByteLength);
        Buffer.BlockCopy(ciphertextBytes, 0, dataToMac, IvByteLength, ciphertextBytes.Length);

        byte[] mac;
        using (var hmac = new HMACSHA256(_macKey))
        {
            mac = hmac.ComputeHash(dataToMac);
        }

        // Wire format: IV[16] ‖ MAC[32] ‖ ciphertext
        var combined = new byte[IvByteLength + MacByteLength + ciphertextBytes.Length];
        Buffer.BlockCopy(aes.IV, 0, combined, 0, IvByteLength);
        Buffer.BlockCopy(mac, 0, combined, IvByteLength, MacByteLength);
        Buffer.BlockCopy(ciphertextBytes, 0, combined, IvByteLength + MacByteLength, ciphertextBytes.Length);

        return Sentinel + Convert.ToBase64String(combined);
    }

    public string Decrypt(string ciphertext)
    {
        // Null, empty, or whitespace-only values can never be a sentinel-prefixed blob. Return
        // them verbatim before touching any cryptographic primitive — this is the primary guard
        // that keeps a sync payload containing blank/legacy notes from throwing an NRE or a
        // FormatException and cascading into a 500.
        if (string.IsNullOrWhiteSpace(ciphertext))
            return ciphertext;

        if (!ciphertext.StartsWith(Sentinel, StringComparison.Ordinal))
            return ciphertext; // legacy plaintext — return as-is for zero-downtime migration

        byte[] combined;
        try
        {
            combined = Convert.FromBase64String(ciphertext[Sentinel.Length..]);
        }
        catch (FormatException ex)
        {
            throw new InvalidOperationException(
                "Patient field decryption failed: ciphertext is not valid Base64.", ex);
        }

        if (combined.Length < IvByteLength + MacByteLength + 1)
            throw new InvalidOperationException(
                "Patient field decryption failed: ciphertext blob is too short to be valid.");

        var iv = combined[..IvByteLength];
        var storedMac = combined[IvByteLength..(IvByteLength + MacByteLength)];
        var encryptedData = combined[(IvByteLength + MacByteLength)..];

        // Verify MAC before decrypting (Encrypt-then-MAC).
        var dataToMac = new byte[IvByteLength + encryptedData.Length];
        Buffer.BlockCopy(iv, 0, dataToMac, 0, IvByteLength);
        Buffer.BlockCopy(encryptedData, 0, dataToMac, IvByteLength, encryptedData.Length);

        byte[] expectedMac;
        using (var hmac = new HMACSHA256(_macKey))
        {
            expectedMac = hmac.ComputeHash(dataToMac);
        }

        if (!CryptographicOperations.FixedTimeEquals(storedMac, expectedMac))
            throw new InvalidOperationException(
                "Patient field decryption failed: authentication tag mismatch. " +
                "The record may have been tampered with or was encrypted with a different key.");

        using var aes = Aes.Create();
        aes.KeySize = 256;
        aes.Key = _aesKey;
        aes.IV = iv;
        aes.Mode = CipherMode.CBC;
        aes.Padding = PaddingMode.PKCS7;

        using var decryptor = aes.CreateDecryptor();
        using var ms = new MemoryStream(encryptedData);
        using var cs = new CryptoStream(ms, decryptor, CryptoStreamMode.Read);
        using var reader = new StreamReader(cs, Encoding.UTF8);
        return reader.ReadToEnd();
    }
}
