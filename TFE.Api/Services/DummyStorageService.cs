using Microsoft.AspNetCore.Http;
using TFE.Api.Interfaces.IServices;

namespace TFE.Api.Services;

public class DummyStorageService : IStorageService
{
    private readonly ILogger<DummyStorageService> _logger;

    public DummyStorageService(ILogger<DummyStorageService> logger)
    {
        _logger = logger;
    }

    public Task<string> UploadFileAsync(IFormFile file)
    {
        var fakeUrl = $"https://fake-supabase-storage.com/{Guid.NewGuid()}/{file.FileName}";
        _logger.LogInformation("[StorageService] Dummy upload for '{FileName}' → {Url}", file.FileName, fakeUrl);
        return Task.FromResult(fakeUrl);
    }

    public Task DeleteFileAsync(string fileUrl)
    {
        _logger.LogInformation("[StorageService] Dummy delete for '{Url}'", fileUrl);
        return Task.CompletedTask;
    }
}
