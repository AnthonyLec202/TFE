using Microsoft.AspNetCore.Http;

namespace TFE.Api.Interfaces.IServices.CollaborativeWall;

public interface IFileStorageService
{
    /// <summary>
    /// Uploads <paramref name="file"/> to <paramref name="bucketName"/> and returns the relative
    /// storage path (e.g. "{guid}.ext"). The path — not a URL — is what callers persist.
    /// </summary>
    Task<string> UploadFileAsync(IFormFile file, string bucketName, CancellationToken cancellationToken = default);

    /// <summary>
    /// Generates a short-lived signed URL granting temporary read access to the object at
    /// <paramref name="storagePath"/> in <paramref name="bucketName"/>. Generated at request time
    /// so the bucket can remain private.
    /// </summary>
    Task<string> GetSignedUrlAsync(string storagePath, string bucketName);

    /// <summary>
    /// Deletes the object at <paramref name="storagePath"/> from <paramref name="bucketName"/>.
    /// </summary>
    Task DeleteFileAsync(string storagePath, string bucketName);
}
