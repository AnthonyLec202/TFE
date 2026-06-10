using Microsoft.EntityFrameworkCore;
using TFE.Api.Data;
using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Models;

namespace TFE.Api.Repositories;

public class NoteRepository : INoteRepository
{
    private readonly ApplicationDbContext _context;

    public NoteRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<List<Note>> GetBySessionIdsAsync(IEnumerable<Guid> sessionIds, CancellationToken cancellationToken = default)
        => _context.Notes
            .Where(n => sessionIds.Contains(n.SessionId))
            .ToListAsync(cancellationToken);

    public void RemoveRange(IEnumerable<Note> notes) => _context.Notes.RemoveRange(notes);

    public Task AddAsync(Note note, CancellationToken cancellationToken = default)
    {
        _context.Notes.Add(note);
        return Task.CompletedTask;
    }
}
