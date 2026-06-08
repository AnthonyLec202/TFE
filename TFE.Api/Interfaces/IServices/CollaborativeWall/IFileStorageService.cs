using Microsoft.AspNetCore.Http;

namespace TFE.Api.Interfaces.IServices.CollaborativeWall;

public interface IFileStorageService
{
    /// <summary>
    /// Uploads <paramref name="file"/> to <paramref name="bucketName"/> and returns the public URL.
    /// A unique storage path is generated internally (Guid + original extension).
    /// </summary>
    Task<string> UploadFileAsync(IFormFile file, string bucketName, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes the object identified by <paramref name="fileUrl"/> from <paramref name="bucketName"/>.
    /// The storage path is extracted from the URL; no-ops gracefully if the path cannot be parsed.
    /// </summary>
    Task DeleteFileAsync(string fileUrl, string bucketName);
}
