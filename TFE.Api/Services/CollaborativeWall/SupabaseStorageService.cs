using Microsoft.AspNetCore.Http;
using TFE.Api.Interfaces.IServices.CollaborativeWall;

namespace TFE.Api.Services.CollaborativeWall;

/// <summary>
/// Production file storage backed by Supabase Storage.
/// Registered as <see cref="IFileStorageService"/> in DI.
/// </summary>
public class SupabaseStorageService : IFileStorageService
{
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

        var publicUrl = _supabase.Storage.From(bucketName).GetPublicUrl(storagePath);

        _logger.LogInformation(
            "[SupabaseStorage] Uploaded '{OriginalName}' → {Url}",
            file.FileName, publicUrl);

        return publicUrl;
    }

    public async Task DeleteFileAsync(string fileUrl, string bucketName)
    {
        var marker = $"/object/public/{bucketName}/";
        var idx = fileUrl.IndexOf(marker, StringComparison.Ordinal);
        if (idx < 0)
        {
            _logger.LogWarning(
                "[SupabaseStorage] Could not extract storage path from URL '{Url}' — skipping delete.",
                fileUrl);
            return;
        }

        var storagePath = fileUrl[(idx + marker.Length)..];

        await _supabase.Storage
            .From(bucketName)
            .Remove(new List<string> { storagePath });

        _logger.LogInformation(
            "[SupabaseStorage] Deleted '{Path}' from bucket '{Bucket}'.",
            storagePath, bucketName);
    }
}
