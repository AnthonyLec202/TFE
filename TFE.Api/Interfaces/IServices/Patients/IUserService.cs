namespace TFE.Api.Interfaces.IServices.Patients;

public interface IUserService
{
    Task DeleteUserAsync(string userId);
}
