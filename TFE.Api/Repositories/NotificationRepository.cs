using Microsoft.EntityFrameworkCore;
using TFE.Api.Data;
using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Models;

namespace TFE.Api.Repositories;

public class NotificationRepository : INotificationRepository
{
    private readonly ApplicationDbContext _context;

    public NotificationRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<List<Notification>> GetUnreadForUserAsync(string userId)
        => _context.Notifications
            .Include(n => n.Actor)
            .Where(n => n.UserId == userId && !n.IsRead)
            .OrderByDescending(n => n.CreatedAt)
            .ToListAsync();

    public Task<Notification?> GetByIdAsync(Guid notificationId)
        => _context.Notifications.FirstOrDefaultAsync(n => n.Id == notificationId);

    public Task AddAsync(Notification notification)
    {
        _context.Notifications.Add(notification);
        return Task.CompletedTask;
    }

    public async Task RemoveByPatientIdAsync(Guid patientId)
    {
        var notifications = await _context.Notifications
            .Where(n => n.PatientId == patientId)
            .ToListAsync();

        // Stage the deletion only; the Service layer commits it via IUnitOfWork.
        _context.Notifications.RemoveRange(notifications);
    }
}
