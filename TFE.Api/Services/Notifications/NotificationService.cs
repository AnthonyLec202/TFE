using Microsoft.AspNetCore.SignalR;
using TFE.Api.DTOs.Notifications;
using TFE.Api.Hubs.CollaborativeWall;
using TFE.Api.Interfaces;
using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Interfaces.IServices.Notifications;
using TFE.Api.Models;

namespace TFE.Api.Services.Notifications;

public class NotificationService : INotificationService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly INotificationRepository _notificationRepository;
    private readonly ICareTeamRepository _careTeamRepository;
    private readonly ICommentRepository _commentRepository;
    private readonly IHubContext<CollaborativeWallHub, ICollaborativeWallClient> _hubContext;

    public NotificationService(
        IUnitOfWork unitOfWork,
        INotificationRepository notificationRepository,
        ICareTeamRepository careTeamRepository,
        ICommentRepository commentRepository,
        IHubContext<CollaborativeWallHub, ICollaborativeWallClient> hubContext)
    {
        _unitOfWork = unitOfWork;
        _notificationRepository = notificationRepository;
        _careTeamRepository = careTeamRepository;
        _commentRepository = commentRepository;
        _hubContext = hubContext;
    }

    public async Task<IEnumerable<NotificationResponse>> GetUnreadNotificationsAsync(string userId)
    {
        var notifications = await _notificationRepository.GetUnreadForUserAsync(userId);
        return notifications.Select(n => ToResponse(n)).ToList();
    }

    public async Task MarkAsReadAsync(Guid notificationId, string userId)
    {
        var notification = await _notificationRepository.GetByIdAsync(notificationId)
            ?? throw new KeyNotFoundException($"Notification {notificationId} not found.");

        if (notification.UserId != userId)
            throw new UnauthorizedAccessException("You can only mark your own notifications as read.");

        notification.IsRead = true;
        await _unitOfWork.SaveChangesAsync();
    }

    public async Task NotifyNewPostAsync(Guid patientId, string authorUserId, Guid postId)
    {
        var careTeam = await _careTeamRepository.GetByPatientIdWithUsersAsync(patientId);
        var recipients = careTeam.Where(ct => ct.UserId != authorUserId).ToList();
        if (recipients.Count == 0) return;

        // Actor user is in the care team load (GetByPatientIdWithUsersAsync includes .User).
        var actor = careTeam.FirstOrDefault(ct => ct.UserId == authorUserId)?.User;
        var targetUrl = $"/patients/{patientId}?postId={postId}";

        var notifications = recipients.Select(ct => new Notification
        {
            Id = Guid.NewGuid(),
            UserId = ct.UserId,
            PatientId = patientId,
            Type = NotificationType.NewPost,
            ActorId = authorUserId,
            IsRead = false,
            CreatedAt = DateTimeOffset.UtcNow,
            TargetUrl = targetUrl,
        }).ToList();

        foreach (var notification in notifications)
            await _notificationRepository.AddAsync(notification);

        await _unitOfWork.SaveChangesAsync();

        foreach (var notification in notifications)
            await _hubContext.Clients.Group(notification.UserId).ReceiveNotification(ToResponse(notification, actor));
    }

    public async Task NotifyNewCommentAsync(Guid commentId)
    {
        var comment = await _commentRepository.GetByIdWithDetailsAsync(commentId)
            ?? throw new KeyNotFoundException($"Comment {commentId} not found.");

        var authorUserId = comment.CreatedById;
        var patientId = comment.Post.PatientId;

        var careTeam = await _careTeamRepository.GetByPatientIdWithUsersAsync(patientId);
        var recipients = careTeam.Where(ct => ct.UserId != authorUserId).ToList();
        if (recipients.Count == 0) return;

        var actor = careTeam.FirstOrDefault(ct => ct.UserId == authorUserId)?.User;
        var targetUrl = $"/patients/{patientId}?postId={comment.Post.Id}&commentId={commentId}";

        var notifications = recipients.Select(ct => new Notification
        {
            Id = Guid.NewGuid(),
            UserId = ct.UserId,
            PatientId = patientId,
            Type = NotificationType.NewComment,
            ActorId = authorUserId,
            IsRead = false,
            CreatedAt = DateTimeOffset.UtcNow,
            TargetUrl = targetUrl,
        }).ToList();

        foreach (var notification in notifications)
            await _notificationRepository.AddAsync(notification);

        await _unitOfWork.SaveChangesAsync();

        foreach (var notification in notifications)
            await _hubContext.Clients.Group(notification.UserId).ReceiveNotification(ToResponse(notification, actor));
    }

    // Used for REST GET responses where the repository has eagerly loaded Notification.Actor.
    // Used for SignalR broadcasts by passing the actor resolved from the in-memory care team load.
    private static NotificationResponse ToResponse(Notification notification, ApplicationUser? actorOverride = null)
    {
        var actor = actorOverride ?? notification.Actor;
        return new NotificationResponse
        {
            Id = notification.Id,
            PatientId = notification.PatientId,
            Type = notification.Type.ToString(),
            ActorFirstName = actor?.FirstName ?? string.Empty,
            ActorLastName = actor?.LastName ?? string.Empty,
            IsRead = notification.IsRead,
            CreatedAt = notification.CreatedAt,
            TargetUrl = notification.TargetUrl,
        };
    }
}
