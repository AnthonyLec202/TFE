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

    public Task<List<Note>> GetForUserAsync(string userId, CancellationToken cancellationToken = default)
        => _context.Notes
            .AsNoTracking()
            // Scope to the requesting user's reachable clinical data: a note is visible when its
            // session is owned by the user (covers patient-less drafts) OR involves at least one
            // patient whose care team includes the user. Mirrors the sessions read scope.
            .Where(n => n.Session!.CreatedById == userId
                || n.Session!.Patients.Any(p => p.CareTeam.Any(ct => ct.UserId == userId)))
            .ToListAsync(cancellationToken);

    public void RemoveRange(IEnumerable<Note> notes) => _context.Notes.RemoveRange(notes);

    public Task AddAsync(Note note, CancellationToken cancellationToken = default)
    {
        _context.Notes.Add(note);
        return Task.CompletedTask;
    }
}
