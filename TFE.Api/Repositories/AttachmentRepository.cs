using Microsoft.EntityFrameworkCore;
using TFE.Api.Data;
using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Models;

namespace TFE.Api.Repositories;

public class AttachmentRepository : IAttachmentRepository
{
    private readonly ApplicationDbContext _context;

    public AttachmentRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task AddAsync(Attachment attachment)
    {
        _context.Attachments.Add(attachment);
        return Task.CompletedTask;
    }

    public void Remove(Attachment attachment) => _context.Attachments.Remove(attachment);

    public void RemoveRange(IEnumerable<Attachment> attachments) => _context.Attachments.RemoveRange(attachments);

    public Task<List<Attachment>> GetByPatientIdAsync(Guid patientId)
        => _context.Attachments
            .Where(a =>
                (a.Post != null && a.Post.PatientId == patientId) ||
                (a.Comment != null && a.Comment.Post.PatientId == patientId))
            .ToListAsync();
}
