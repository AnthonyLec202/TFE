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
    /// Generates short-lived signed URLs granting temporary read access to the given storage paths,
    /// in a single round-trip. Returns a map from storage path to its signed URL; paths that could
    /// not be signed are omitted. Generated at request time so the bucket can remain private.
    /// </summary>
    Task<IReadOnlyDictionary<string, string>> GetSignedUrlsAsync(IReadOnlyCollection<string> storagePaths, string bucketName);

    /// <summary>
    /// Deletes the object at <paramref name="storagePath"/> from <paramref name="bucketName"/>.
    /// </summary>
    Task DeleteFileAsync(string storagePath, string bucketName);
}
