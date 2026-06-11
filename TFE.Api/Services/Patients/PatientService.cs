using TFE.Api.DTOs.Patients;
using TFE.Api.Exceptions;
using TFE.Api.Interfaces;
using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Interfaces.IServices.CollaborativeWall;
using TFE.Api.Interfaces.IServices.Patients;
using TFE.Api.Models;

namespace TFE.Api.Services.Patients;

public class PatientService : IPatientService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPatientRepository _patientRepository;
    private readonly ICareTeamRepository _careTeamRepository;
    private readonly IAttachmentRepository _attachmentRepository;
    private readonly IFileStorageService _fileStorage;
    private readonly string _bucketName;

    public PatientService(
        IUnitOfWork unitOfWork,
        IPatientRepository patientRepository,
        ICareTeamRepository careTeamRepository,
        IAttachmentRepository attachmentRepository,
        IFileStorageService fileStorage,
        IConfiguration configuration)
    {
        _unitOfWork = unitOfWork;
        _patientRepository = patientRepository;
        _careTeamRepository = careTeamRepository;
        _attachmentRepository = attachmentRepository;
        _fileStorage = fileStorage;
        _bucketName = configuration["Supabase:AttachmentsBucket"]
            ?? throw new InvalidOperationException("Supabase:AttachmentsBucket is not configured.");
    }

    public async Task<PatientResponse> CreatePatientAsync(CreatePatientRequest request, string currentUserId)
    {
        // Honour the client-provided id so offline-created references stay valid after sync;
        // fall back to a fresh id only when the client did not supply one.
        var patientId = request.Id == Guid.Empty ? Guid.NewGuid() : request.Id;

        // Fast-path idempotence: a retried submission can re-send an already-created patient (e.g.
        // the first POST succeeded but its response was lost). Return the existing record rather
        // than attempting a doomed insert, so the client queue can clear the payload safely.
        var existing = await _patientRepository.GetByIdAsync(patientId);
        if (existing is not null)
        {
            var existingCareTeam = await _careTeamRepository.GetForUserAndPatientAsync(currentUserId, patientId);
            return ToResponse(existing, existingCareTeam);
        }

        // Built before the transaction so they remain in scope for the idempotent catch below.
        var patient = new Patient
        {
            Id = patientId,
            FirstName = request.FirstName,
            LastName = request.LastName,
            BirthDate = request.BirthDate,
            CreatedAt = DateTime.UtcNow
        };
        var careTeam = new CareTeam
        {
            UserId = currentUserId,
            PatientId = patientId,
            Role = RelationshipType.Other,
            CustomRoleName = "Neuropsychologue"
        };

        await using var transaction = await _unitOfWork.BeginTransactionAsync();
        try
        {
            await _patientRepository.CreateAsync(patient);
            await _careTeamRepository.CreateAsync(careTeam);

            await transaction.CommitAsync();
            return ToResponse(patient, careTeam);
        }
        catch (DuplicateEntityException)
        {
            // TOCTOU race: a concurrent request inserted this patient between our existence check
            // and our own insert. Treat the duplicate as success (idempotent). The response is
            // built from the in-memory objects — same id and payload as the persisted row — which
            // also avoids re-querying a key already tracked by the failed insert (no EF conflict).
            await transaction.RollbackAsync();
            return ToResponse(patient, careTeam);
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<IEnumerable<PatientResponse>> GetPatientsForUserAsync(string userId)
    {
        // GetByUserIdAsync uses filtered Include, so each patient carries only the requesting user's CareTeam entry
        var patients = await _patientRepository.GetByUserIdAsync(userId);
        return patients.Select(p => ToResponse(p, p.CareTeam.FirstOrDefault()));
    }

    public async Task<PatientResponse> GetPatientByIdAsync(Guid patientId, string userId)
    {
        if (!await _careTeamRepository.IsUserInCareTeamAsync(userId, patientId))
            throw new UnauthorizedAccessException("Access to this patient record is denied.");

        var patient = await _patientRepository.GetByIdAsync(patientId)
                      ?? throw new KeyNotFoundException($"Patient {patientId} not found.");

        var careTeamEntry = await _careTeamRepository.GetForUserAndPatientAsync(userId, patientId);
        return ToResponse(patient, careTeamEntry);
    }

    public async Task<PatientResponse> UpdatePatientAsync(Guid patientId, UpdatePatientRequest request, string userId)
    {
        await EnsureAdminAsync(userId, patientId);

        var patient = await _patientRepository.GetByIdAsync(patientId)
                      ?? throw new KeyNotFoundException($"Patient {patientId} not found.");

        patient.FirstName = request.FirstName;
        patient.LastName = request.LastName;
        patient.BirthDate = request.BirthDate;

        var updated = await _patientRepository.UpdateAsync(patient);
        var ct = await _careTeamRepository.GetForUserAndPatientAsync(userId, patientId);
        return ToResponse(updated, ct);
    }

    public async Task DeletePatientAsync(Guid patientId, string userId)
    {
        await EnsureAdminAsync(userId, patientId);

        var patient = await _patientRepository.GetByIdAsync(patientId)
                      ?? throw new KeyNotFoundException($"Patient {patientId} not found.");

        await using var transaction = await _unitOfWork.BeginTransactionAsync();
        try
        {
            // Purge the physical files from storage BEFORE the DB cascade removes the attachment
            // rows — otherwise the files would be orphaned in the bucket forever.
            var attachments = await _attachmentRepository.GetByPatientIdAsync(patientId);
            foreach (var attachment in attachments)
                await _fileStorage.DeleteFileAsync(attachment.StoragePath, _bucketName);

            // Database-level CASCADE handles CareTeams, EnrollmentTokens, Posts, Comments,
            // Attachments, and Session links automatically.
            await _patientRepository.DeleteAsync(patient);

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    private async Task EnsureAdminAsync(string userId, Guid patientId)
    {
        var ct = await _careTeamRepository.GetForUserAndPatientAsync(userId, patientId);
        if (ct is null || ResolveUserRole(ct) != "Admin")
            throw new UnauthorizedAccessException("Only the patient's administrator can perform this action.");
    }

    private static PatientResponse ToResponse(Patient patient, CareTeam? ct = null) => new()
    {
        Id = patient.Id,
        FirstName = patient.FirstName,
        LastName = patient.LastName,
        BirthDate = patient.BirthDate,
        UserRole = ResolveUserRole(ct)
    };

    private static string ResolveUserRole(CareTeam? ct) => ct switch
    {
        { CustomRoleName: "Neuropsychologue" } => "Admin",
        { Role: RelationshipType.Parent }      => "Parent",
        not null                               => "Collaborator",
        _                                      => "Collaborator"
    };
}
