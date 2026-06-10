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

    public Task AddAsync(Session session, CancellationToken cancellationToken = default)
    {
        _context.Sessions.Add(session);
        return Task.CompletedTask;
    }
}
