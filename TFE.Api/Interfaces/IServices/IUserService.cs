namespace TFE.Api.Interfaces.IServices;

public interface IUserService
{
    Task DeleteUserAsync(string userId);
}
