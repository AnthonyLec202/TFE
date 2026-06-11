using Microsoft.AspNetCore.Http;
using TFE.Api.Interfaces.IServices.CollaborativeWall;

namespace TFE.Api.Services.CollaborativeWall;

/// <summary>
/// Production file storage backed by Supabase Storage (private bucket).
/// Persists only the relative storage path; read access is granted through short-lived
/// signed URLs generated on demand. Registered as <see cref="IFileStorageService"/> in DI.
/// </summary>
public class SupabaseStorageService : IFileStorageService
{
    // Signed URLs are valid for one hour.
    private const int SignedUrlExpirySeconds = 3600;

    private readonly Supabase.Client _supabase;
    private readonly ILogger<SupabaseStorageService> _logger;

    public SupabaseStorageService(Supabase.Client supabase, ILogger<SupabaseStorageService> logger)
    {
        _supabase = supabase;
        _logger = logger;
    }

    public async Task<string> UploadFileAsync(
        IFormFile file,
        string bucketName,
        CancellationToken cancellationToken = default)
    {
        var extension = Path.GetExtension(file.FileName);
        var storagePath = $"{Guid.NewGuid()}{extension}";

        byte[] fileBytes;
        using (var ms = new MemoryStream())
        {
            await file.CopyToAsync(ms, cancellationToken);
            fileBytes = ms.ToArray();
        }

        await _supabase.Storage
            .From(bucketName)
            .Upload(fileBytes, storagePath, new Supabase.Storage.FileOptions
            {
                ContentType = file.ContentType,
                Upsert = false,
            });

        _logger.LogInformation("[SupabaseStorage] Uploaded file to path '{Path}'.", storagePath);

        // Persist the relative path only; the public/signed URL is derived at read time.
        return storagePath;
    }

    public async Task<IReadOnlyDictionary<string, string>> GetSignedUrlsAsync(
        IReadOnlyCollection<string> storagePaths, string bucketName)
    {
        var map = new Dictionary<string, string>();
        if (storagePaths.Count == 0)
            return map;

        var distinctPaths = storagePaths.Distinct().ToList();
        var responses = await _supabase.Storage
            .From(bucketName)
            .CreateSignedUrls(distinctPaths, SignedUrlExpirySeconds);

        if (responses is not null)
        {
            foreach (var response in responses)
            {
                if (!string.IsNullOrEmpty(response.Path) && !string.IsNullOrEmpty(response.SignedUrl))
                    map[response.Path!] = response.SignedUrl!;
            }
        }

        return map;
    }

    public async Task DeleteFileAsync(string storagePath, string bucketName)
    {
        if (string.IsNullOrWhiteSpace(storagePath))
            return;

        await _supabase.Storage
            .From(bucketName)
            .Remove(new List<string> { storagePath });

        _logger.LogInformation(
            "[SupabaseStorage] Deleted '{Path}' from bucket '{Bucket}'.",
            storagePath, bucketName);
    }
}
