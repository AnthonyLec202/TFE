using Microsoft.EntityFrameworkCore;
using TFE.Api.Data;
using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Models;

namespace TFE.Api.Repositories;

public class PatientRepository : IPatientRepository
{
    private readonly ApplicationDbContext _context;

    public PatientRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Patient> CreateAsync(Patient patient)
    {
        _context.Patients.Add(patient);
        await _context.SaveChangesAsync();
        return patient;
    }

    public async Task<Patient?> GetByIdAsync(Guid id)
        => await _context.Patients.FirstOrDefaultAsync(p => p.Id == id);

    public async Task<Patient> UpdateAsync(Patient patient)
    {
        _context.Patients.Update(patient);
        await _context.SaveChangesAsync();
        return patient;
    }

    public async Task DeleteAsync(Patient patient)
    {
        _context.Patients.Remove(patient);
        await _context.SaveChangesAsync();
    }

    // Filtered Include loads only the requesting user's CareTeam entry alongside each patient
    public async Task<IEnumerable<Patient>> GetByUserIdAsync(string userId)
        => await _context.Patients
            .Include(p => p.CareTeam.Where(ct => ct.UserId == userId))
            .Where(p => p.CareTeam.Any(ct => ct.UserId == userId))
            .OrderBy(p => p.LastName)
            .ThenBy(p => p.FirstName)
            .ToListAsync();

    public async Task<IEnumerable<Patient>> GetByIdsAsync(IEnumerable<Guid> ids)
        => await _context.Patients
            .Where(p => ids.Contains(p.Id))
            .ToListAsync();
}
