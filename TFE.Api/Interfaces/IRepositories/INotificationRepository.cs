using TFE.Api.Models;

namespace TFE.Api.Interfaces.IRepositories;

public interface INotificationRepository
{
    Task<List<Notification>> GetUnreadForUserAsync(string userId);
    Task<Notification?> GetByIdAsync(Guid notificationId);
    Task AddAsync(Notification notification);

    /// <summary>
    /// Stages removal of every notification targeting the given patient (across all recipients).
    /// Used when a patient is archived so no collaborator's feed keeps pointing at a now read-restricted
    /// dossier. Stages only — the Service commits via IUnitOfWork.
    /// </summary>
    Task RemoveByPatientIdAsync(Guid patientId);
}
