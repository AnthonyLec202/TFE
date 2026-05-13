using Microsoft.EntityFrameworkCore;
using TFE.Api.Data;
using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Models;

namespace TFE.Api.Repositories;

public class EnrollmentTokenRepository : IEnrollmentTokenRepository
{
    private readonly ApplicationDbContext _context;

    public EnrollmentTokenRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<EnrollmentToken> CreateAsync(EnrollmentToken token)
    {
        _context.EnrollmentTokens.Add(token);
        await _context.SaveChangesAsync();
        return token;
    }

    public Task<EnrollmentToken?> FindByHashAsync(string tokenHash)
        => _context.EnrollmentTokens
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash && !t.IsUsed);

    public async Task MarkAsUsedAsync(EnrollmentToken token)
    {
        token.IsUsed = true;
        await _context.SaveChangesAsync();
    }
}
