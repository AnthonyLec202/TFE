using Microsoft.EntityFrameworkCore;
using TFE.Api.Data;
using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Models;

namespace TFE.Api.Repositories;

public class TherapeuticToolRepository : ITherapeuticToolRepository
{
    private readonly ApplicationDbContext _context;

    public TherapeuticToolRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<List<TherapeuticTool>> GetAllAsync(
        string? query = null,
        ToolType? type = null,
        CbtTheme? theme = null,
        CancellationToken cancellationToken = default)
    {
        IQueryable<TherapeuticTool> tools = _context.TherapeuticTools.AsNoTracking();

        if (type.HasValue)
            tools = tools.Where(t => t.Type == type.Value);

        if (theme.HasValue)
            tools = tools.Where(t => t.Theme == theme.Value);

        if (!string.IsNullOrWhiteSpace(query))
        {
            var pattern = $"%{query.Trim()}%";
            tools = tools.Where(t =>
                EF.Functions.ILike(t.Title, pattern) ||
                EF.Functions.ILike(t.Description, pattern));
        }

        return tools
            .OrderBy(t => t.Title)
            .ToListAsync(cancellationToken);
    }

    public Task<TherapeuticTool?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => _context.TherapeuticTools.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

    public Task<List<TherapeuticTool>> GetByIdsAsync(IEnumerable<Guid> ids, CancellationToken cancellationToken = default)
        => _context.TherapeuticTools
            .Where(t => ids.Contains(t.Id))
            .ToListAsync(cancellationToken);

    public Task AddAsync(TherapeuticTool tool, CancellationToken cancellationToken = default)
        => _context.TherapeuticTools.AddAsync(tool, cancellationToken).AsTask();

    public void Update(TherapeuticTool tool)
        => _context.Entry(tool).State = EntityState.Modified;

    public void Remove(TherapeuticTool tool)
        => _context.TherapeuticTools.Remove(tool);
}
