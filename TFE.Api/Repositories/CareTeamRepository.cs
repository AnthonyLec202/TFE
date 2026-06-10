using Microsoft.EntityFrameworkCore;
using TFE.Api.Data;
using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Models;

namespace TFE.Api.Repositories;

public class CareTeamRepository : ICareTeamRepository
{
    private readonly ApplicationDbContext _context;

    public CareTeamRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<CareTeam> CreateAsync(CareTeam careTeam)
    {
        _context.CareTeams.Add(careTeam);
        await _context.SaveChangesAsync();
        return careTeam;
    }

    public Task<bool> IsUserInCareTeamAsync(string userId, Guid patientId)
        => _context.CareTeams.AnyAsync(ct => ct.UserId == userId && ct.PatientId == patientId);

    public Task<CareTeam?> GetForUserAndPatientAsync(string userId, Guid patientId)
        => _context.CareTeams.FirstOrDefaultAsync(ct => ct.UserId == userId && ct.PatientId == patientId);

    public Task<List<CareTeam>> GetByPatientIdWithUsersAsync(Guid patientId)
        => _context.CareTeams
            .Include(ct => ct.User)
            .Where(ct => ct.PatientId == patientId)
            .ToListAsync();
}
