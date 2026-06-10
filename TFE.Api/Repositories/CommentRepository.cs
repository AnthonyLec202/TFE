using Microsoft.EntityFrameworkCore;
using TFE.Api.Data;
using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Models;

namespace TFE.Api.Repositories;

public class CommentRepository : ICommentRepository
{
    private readonly ApplicationDbContext _context;

    public CommentRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<Comment?> GetByIdWithDetailsAsync(Guid commentId, CancellationToken cancellationToken = default)
        => _context.Comments
            .Include(c => c.Post)
            .Include(c => c.Attachments)
            .FirstOrDefaultAsync(c => c.Id == commentId, cancellationToken);

    public Task<List<Comment>> GetByAuthorWithAttachmentsAsync(string userId)
        => _context.Comments
            .Include(c => c.Attachments)
            .Where(c => c.CreatedById == userId)
            .ToListAsync();

    public Task AddAsync(Comment comment)
    {
        _context.Comments.Add(comment);
        return Task.CompletedTask;
    }

    public void Remove(Comment comment) => _context.Comments.Remove(comment);

    public Task LoadAttachmentsAsync(Comment comment, CancellationToken cancellationToken = default)
        => _context.Entry(comment).Collection(c => c.Attachments).LoadAsync(cancellationToken);
}
