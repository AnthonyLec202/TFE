using TFE.Api.Models;

namespace TFE.Api.Interfaces.IRepositories;

public interface IAttachmentRepository
{
    Task AddAsync(Attachment attachment);

    void Remove(Attachment attachment);

    void RemoveRange(IEnumerable<Attachment> attachments);

    /// <summary>
    /// Returns every attachment belonging to the given patient — both those on the patient's
    /// posts and those on comments of those posts. Used to purge physical files before a patient
    /// is deleted (the DB cascade only removes the rows, not the stored files).
    /// </summary>
    Task<List<Attachment>> GetByPatientIdAsync(Guid patientId);
}
