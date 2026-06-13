using TFE.Api.Models;

namespace TFE.Api.Interfaces.IRepositories;

public interface INotificationRepository
{
    Task<List<Notification>> GetUnreadForUserAsync(string userId);
    Task<Notification?> GetByIdAsync(Guid notificationId);
    Task AddAsync(Notification notification);
}
