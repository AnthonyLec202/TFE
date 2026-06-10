using TFE.Api.Models;

namespace TFE.Api.Interfaces.IRepositories;

public interface IAttachmentRepository
{
    Task AddAsync(Attachment attachment);

    void Remove(Attachment attachment);

    void RemoveRange(IEnumerable<Attachment> attachments);
}
