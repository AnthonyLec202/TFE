using Microsoft.AspNetCore.Http;

namespace TFE.Api.Interfaces.IServices.CollaborativeWall;

public interface IStorageService
{
    Task<string> UploadFileAsync(IFormFile file);
    Task DeleteFileAsync(string fileUrl);
}
