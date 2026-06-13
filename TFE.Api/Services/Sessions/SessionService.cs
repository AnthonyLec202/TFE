using TFE.Api.DTOs.Sessions;
using TFE.Api.Interfaces;
using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Interfaces.IServices.Sessions;
using TFE.Api.Models;

namespace TFE.Api.Services.Sessions;

public class SessionService : ISessionService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ISessionRepository _sessionRepository;
    private readonly INoteRepository _noteRepository;
    private readonly IPatientRepository _patientRepository;

    public SessionService(
        IUnitOfWork unitOfWork,
        ISessionRepository sessionRepository,
        INoteRepository noteRepository,
        IPatientRepository patientRepository)
    {
        _unitOfWork = unitOfWork;
        _sessionRepository = sessionRepository;
        _noteRepository = noteRepository;
        _patientRepository = patientRepository;
    }

    public async Task SyncBatchAsync(SessionSyncBatchRequest request, CancellationToken cancellationToken)
    {
        await using var transaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);

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
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Phase 2: insert the authoritative note records from the client.
        await InsertNotesAsync(uniqueNotes, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await transaction.CommitAsync(cancellationToken);
    }

    public async Task UpdateAsync(Guid id, UpdateSessionRequest request, CancellationToken cancellationToken)
    {
        await using var transaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            var session = await _sessionRepository.GetByIdWithPatientsAsync(id, cancellationToken)
                ?? throw new KeyNotFoundException($"Session {id} not found.");

            session.Title = request.Title;
            session.Date = request.Date;
            session.Time = request.Time;
            session.Status = request.Status;

            // Replace the patient assignment: resolve the requested ids, then rebuild the
            // many-to-many join from the loaded (tracked) collection.
            var patientIds = request.PatientIds.Distinct().ToList();
            var patients = await _patientRepository.GetByIdsAsync(patientIds);
            var patientMap = patients.ToDictionary(p => p.Id);

            session.Patients.Clear();
            foreach (var patientId in patientIds)
                if (patientMap.TryGetValue(patientId, out var patient))
                    session.Patients.Add(patient);

            await _sessionRepository.UpdateAsync(session, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var transaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            // FK_Notes_Sessions_SessionId is configured with ON DELETE CASCADE (see ApplicationDbContext),
            // which also cascades to SessionNotes and the PatientSession join, so removing the session
            // is sufficient to clean up its dependent rows.
            var removed = await _sessionRepository.DeleteAsync(id, cancellationToken);
            if (!removed)
                throw new KeyNotFoundException($"Session {id} not found.");

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private async Task UpsertSessionsAsync(List<SyncSessionRequest> requests, CancellationToken ct)
    {
        if (requests.Count == 0) return;

        var ids = requests.Select(r => r.Id).ToList();

        var existing = await _sessionRepository.GetByIdsWithPatientsAsync(ids, ct);
        var existingMap = existing.ToDictionary(s => s.Id);

        // Collect all referenced patient IDs up front to batch the DB lookup
        var allPatientIds = requests.SelectMany(r => r.PatientIds).Distinct().ToList();
        var patients = await _patientRepository.GetByIdsAsync(allPatientIds);
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
                session.Status = req.Status;

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
                    Status = req.Status,
                };
                foreach (var patient in linkedPatients)
                    newSession.Patients.Add(patient);

                await _sessionRepository.AddAsync(newSession, ct);
            }
        }
    }

    private async Task DeleteExistingNotesBySessionIdAsync(List<SyncNoteRequest> requests, CancellationToken ct)
    {
        if (requests.Count == 0) return;

        var sessionIds = requests.Select(r => r.SessionId).ToList();

        var existingNotes = await _noteRepository.GetBySessionIdsAsync(sessionIds, ct);

        if (existingNotes.Count > 0)
            _noteRepository.RemoveRange(existingNotes);
    }

    private async Task InsertNotesAsync(List<SyncNoteRequest> requests, CancellationToken ct)
    {
        if (requests.Count == 0) return;

        foreach (var req in requests)
        {
            await _noteRepository.AddAsync(new Note
            {
                Id = req.Id,
                SessionId = req.SessionId,
                Content = req.Content,
                LastModifiedAt = req.LastModifiedAt,
            }, ct);
        }
    }
}
