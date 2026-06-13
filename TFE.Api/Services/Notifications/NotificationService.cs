using Microsoft.AspNetCore.SignalR;
using TFE.Api.DTOs.CollaborativeWall;
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
    private readonly IPatientRepository _patientRepository;
    private readonly ICommentRepository _commentRepository;
    private readonly IHubContext<CollaborativeWallHub, ICollaborativeWallClient> _hubContext;

    public NotificationService(
        IUnitOfWork unitOfWork,
        INotificationRepository notificationRepository,
        ICareTeamRepository careTeamRepository,
        IPatientRepository patientRepository,
        ICommentRepository commentRepository,
        IHubContext<CollaborativeWallHub, ICollaborativeWallClient> hubContext)
    {
        _unitOfWork = unitOfWork;
        _notificationRepository = notificationRepository;
        _careTeamRepository = careTeamRepository;
        _patientRepository = patientRepository;
        _commentRepository = commentRepository;
        _hubContext = hubContext;
    }

    public async Task<IEnumerable<NotificationResponse>> GetUnreadNotificationsAsync(string userId)
    {
        var notifications = await _notificationRepository.GetUnreadForUserAsync(userId);
        return notifications.Select(ToResponse).ToList();
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

    public async Task NotifyNewPostAsync(Guid patientId, string authorUserId, PostResponse post)
    {
        var careTeam = await _careTeamRepository.GetByPatientIdWithUsersAsync(patientId);
        var recipients = careTeam.Where(ct => ct.UserId != authorUserId).ToList();
        if (recipients.Count == 0) return;

        var patient = await _patientRepository.GetByIdAsync(patientId)
            ?? throw new KeyNotFoundException($"Patient {patientId} not found.");

        var authorName = $"{post.AuthorFirstName} {post.AuthorLastName}".Trim();
        var patientName = $"{patient.FirstName} {patient.LastName}".Trim();
        const string title = "Nouvelle publication";
        var message = string.IsNullOrEmpty(authorName)
            ? $"Une nouvelle publication a été ajoutée au mur de {patientName}."
            : $"{authorName} a publié sur le mur de {patientName}.";

        var notifications = recipients.Select(ct => new Notification
        {
            Id = Guid.NewGuid(),
            UserId = ct.UserId,
            PatientId = patientId,
            Title = title,
            Message = message,
            IsRead = false,
            CreatedAt = DateTimeOffset.UtcNow,
        }).ToList();

        foreach (var notification in notifications)
            await _notificationRepository.AddAsync(notification);

        await _unitOfWork.SaveChangesAsync();

        foreach (var notification in notifications)
            await _hubContext.Clients.Group(notification.UserId).ReceiveNotification(ToResponse(notification));
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

        var patient = await _patientRepository.GetByIdAsync(patientId)
            ?? throw new KeyNotFoundException($"Patient {patientId} not found.");

        var author = careTeam.FirstOrDefault(ct => ct.UserId == authorUserId)?.User;
        var authorName = author is null ? string.Empty : $"{author.FirstName} {author.LastName}".Trim();
        var patientName = $"{patient.FirstName} {patient.LastName}".Trim();
        const string title = "Nouveau commentaire";
        var message = string.IsNullOrEmpty(authorName)
            ? $"Un nouveau commentaire a été ajouté sur le mur de {patientName}."
            : $"{authorName} a ajouté un commentaire sur le mur de {patientName}.";

        var notifications = recipients.Select(ct => new Notification
        {
            Id = Guid.NewGuid(),
            UserId = ct.UserId,
            PatientId = patientId,
            Title = title,
            Message = message,
            IsRead = false,
            CreatedAt = DateTimeOffset.UtcNow,
        }).ToList();

        foreach (var notification in notifications)
            await _notificationRepository.AddAsync(notification);

        await _unitOfWork.SaveChangesAsync();

        foreach (var notification in notifications)
            await _hubContext.Clients.Group(notification.UserId).ReceiveNotification(ToResponse(notification));
    }

    private static NotificationResponse ToResponse(Notification notification) => new()
    {
        Id = notification.Id,
        PatientId = notification.PatientId,
        Title = notification.Title,
        Message = notification.Message,
        IsRead = notification.IsRead,
        CreatedAt = notification.CreatedAt,
    };
}
