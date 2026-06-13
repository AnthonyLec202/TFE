using Microsoft.EntityFrameworkCore;
using TFE.Api.Data;
using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Models;

namespace TFE.Api.Repositories;

public class SessionRepository : ISessionRepository
{
    private readonly ApplicationDbContext _context;

    public SessionRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<List<Session>> GetByIdsWithPatientsAsync(IEnumerable<Guid> ids, CancellationToken cancellationToken = default)
        => _context.Sessions
            .Include(s => s.Patients)
            .Where(s => ids.Contains(s.Id))
            .ToListAsync(cancellationToken);

    public Task<Session?> GetByIdWithPatientsAsync(Guid id, CancellationToken cancellationToken = default)
        => _context.Sessions
            .Include(s => s.Patients)
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

    public Task AddAsync(Session session, CancellationToken cancellationToken = default)
    {
        _context.Sessions.Add(session);
        return Task.CompletedTask;
    }

    public Task DeleteAttendancesBySessionIdsAsync(IEnumerable<Guid> sessionIds, CancellationToken cancellationToken = default)
        => _context.SessionAttendances
            .Where(sa => sessionIds.Contains(sa.SessionId))
            .ExecuteDeleteAsync(cancellationToken);

    public Task AddAttendancesAsync(IEnumerable<SessionAttendance> attendances, CancellationToken cancellationToken = default)
        => _context.SessionAttendances.AddRangeAsync(attendances, cancellationToken);

    public Task UpdateAsync(Session session, CancellationToken cancellationToken = default)
    {
        // Mark only the session entity as modified. The many-to-many patient changes are tracked
        // independently through the loaded Patients collection, so we avoid DbSet.Update here
        // (which would also flag the linked Patient rows as modified and rewrite them needlessly).
        _context.Entry(session).State = EntityState.Modified;
        return Task.CompletedTask;
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var session = await _context.Sessions.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (session is null) return false;

        _context.Sessions.Remove(session);
        return true;
    }
}
