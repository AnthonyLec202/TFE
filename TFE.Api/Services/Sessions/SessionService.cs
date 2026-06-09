using Microsoft.EntityFrameworkCore;
using TFE.Api.Data;
using TFE.Api.DTOs.Sessions;
using TFE.Api.Interfaces.IServices.Sessions;
using TFE.Api.Models;

namespace TFE.Api.Services.Sessions;

public class SessionService : ISessionService
{
    private readonly ApplicationDbContext _context;

    public SessionService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task SyncBatchAsync(SessionSyncBatchRequest request, CancellationToken cancellationToken)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

        // Deduplicate: when the client batches multiple offline saves, the same session or
        // note can appear more than once. Keep only the most recent entry for each key.
        var uniqueSessions = request.Sessions
            .GroupBy(s => s.Id)
            .Select(g => g.OrderByDescending(s => s.Id).First())
            .ToList();

        var uniqueNotes = request.Notes
            .GroupBy(n => n.SessionId)
            .Select(g => g.OrderByDescending(n => n.LastModifiedAt).First())
            .ToList();

        await UpsertSessionsAsync(uniqueSessions, cancellationToken);

        // Phase 1: remove any stale notes that share a SessionId with incoming requests.
        // Flushing here forces the SQL DELETE to execute before the INSERT, which is required
        // because EF Core's command batching does not guarantee DELETE-before-INSERT order
        // for rows that share a unique-constrained column.
        await DeleteExistingNotesBySessionIdAsync(uniqueNotes, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        // Phase 2: insert the authoritative note records from the client.
        InsertNotes(uniqueNotes);
        await _context.SaveChangesAsync(cancellationToken);

        await transaction.CommitAsync(cancellationToken);
    }

    private async Task UpsertSessionsAsync(List<SyncSessionRequest> requests, CancellationToken ct)
    {
        if (requests.Count == 0) return;

        var ids = requests.Select(r => r.Id).ToList();

        var existing = await _context.Sessions
            .Include(s => s.Patients)
            .Where(s => ids.Contains(s.Id))
            .ToListAsync(ct);

        var existingMap = existing.ToDictionary(s => s.Id);

        // Collect all referenced patient IDs up front to batch the DB lookup
        var allPatientIds = requests.SelectMany(r => r.PatientIds).Distinct().ToList();
        var patients = await _context.Patients
            .Where(p => allPatientIds.Contains(p.Id))
            .ToListAsync(ct);
        var patientMap = patients.ToDictionary(p => p.Id);

        foreach (var req in requests)
        {
            var linkedPatients = req.PatientIds
                .Where(pid => patientMap.ContainsKey(pid))
                .Select(pid => patientMap[pid])
                .ToList();

            if (existingMap.TryGetValue(req.Id, out var session))
            {
                session.Title = req.Title;
                session.Date = req.Date;
                session.Time = req.Time;

                session.Patients.Clear();
                foreach (var patient in linkedPatients)
                    session.Patients.Add(patient);
            }
            else
            {
                var newSession = new Session
                {
                    Id = req.Id,
                    Title = req.Title,
                    Date = req.Date,
                    Time = req.Time,
                };
                foreach (var patient in linkedPatients)
                    newSession.Patients.Add(patient);

                _context.Sessions.Add(newSession);
            }
        }
    }

    private async Task DeleteExistingNotesBySessionIdAsync(List<SyncNoteRequest> requests, CancellationToken ct)
    {
        if (requests.Count == 0) return;

        var sessionIds = requests.Select(r => r.SessionId).ToList();

        var existingNotes = await _context.Notes
            .Where(n => sessionIds.Contains(n.SessionId))
            .ToListAsync(ct);

        if (existingNotes.Count > 0)
            _context.Notes.RemoveRange(existingNotes);
    }

    private void InsertNotes(List<SyncNoteRequest> requests)
    {
        if (requests.Count == 0) return;

        foreach (var req in requests)
        {
            _context.Notes.Add(new Note
            {
                Id = req.Id,
                SessionId = req.SessionId,
                Content = req.Content,
                LastModifiedAt = req.LastModifiedAt,
            });
        }
    }
}
