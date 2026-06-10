using Microsoft.EntityFrameworkCore;
using TFE.Api.Data;
using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Models;

namespace TFE.Api.Repositories;

public class PostRepository : IPostRepository
{
    private readonly ApplicationDbContext _context;

    public PostRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<List<Post>> GetWallForPatientAsync(Guid patientId, bool isAdmin, string userRelationshipRole, CancellationToken cancellationToken = default)
        => _context.Posts
            .Where(p => p.PatientId == patientId)
            .Where(p => isAdmin || !p.ExcludedRoles.Any(r => r == userRelationshipRole))
            .Include(p => p.Comments.OrderBy(c => c.CreatedAt))
                .ThenInclude(c => c.Attachments)
            .Include(p => p.Attachments)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(cancellationToken);

    public Task<Post?> GetByIdAsync(Guid postId, CancellationToken cancellationToken = default)
        => _context.Posts.FirstOrDefaultAsync(p => p.Id == postId, cancellationToken);

    public Task<Post?> GetByIdWithDetailsAsync(Guid postId, CancellationToken cancellationToken = default)
        => _context.Posts
            .Include(p => p.Comments.OrderBy(c => c.CreatedAt))
                .ThenInclude(c => c.Attachments)
            .Include(p => p.Attachments)
            .FirstOrDefaultAsync(p => p.Id == postId, cancellationToken);

    public Task<List<Post>> GetByAuthorWithAttachmentsAsync(string userId)
        => _context.Posts
            .Include(p => p.Attachments)
            .Where(p => p.CreatedById == userId)
            .ToListAsync();

    public Task AddAsync(Post post)
    {
        _context.Posts.Add(post);
        return Task.CompletedTask;
    }

    public void Remove(Post post) => _context.Posts.Remove(post);

    public Task LoadAttachmentsAsync(Post post, CancellationToken cancellationToken = default)
        => _context.Entry(post).Collection(p => p.Attachments).LoadAsync(cancellationToken);
}
