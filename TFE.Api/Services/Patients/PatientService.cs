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
    private readonly INotificationRepository _notificationRepository;
    private readonly IFileStorageService _fileStorage;
    private readonly string _bucketName;

    public PatientService(
        IUnitOfWork unitOfWork,
        IPatientRepository patientRepository,
        ICareTeamRepository careTeamRepository,
        IAttachmentRepository attachmentRepository,
        INotificationRepository notificationRepository,
        IFileStorageService fileStorage,
        IConfiguration configuration)
    {
        _unitOfWork = unitOfWork;
        _patientRepository = patientRepository;
        _careTeamRepository = careTeamRepository;
        _attachmentRepository = attachmentRepository;
        _notificationRepository = notificationRepository;
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
            IsArchived = request.IsArchived,
            CreatedAt = DateTime.UtcNow
        };
        var careTeam = new CareTeam
        {
            UserId = currentUserId,
            PatientId = patientId,
            Role = RelationshipType.Other,
            CustomRoleName = CareTeamRoleResolver.ManagingPsychologistRoleName
        };

        await using var transaction = await _unitOfWork.BeginTransactionAsync();
        try
        {
            await _patientRepository.CreateAsync(patient);
            await _careTeamRepository.AddAsync(careTeam);
            // The care-team membership is only staged by the repository; without this the dossier
            // would commit with no members and its creator would lose access to it.
            await _unitOfWork.SaveChangesAsync();

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

        // RBAC: an archived dossier is visible only to the managing psychologist (Admin). Any other
        // role (parent, teacher, …) is denied even with a valid care-team membership, blocking direct
        // URL/API access to an archived record.
        if (patient.IsArchived && !CareTeamRoleResolver.IsAdmin(careTeamEntry))
            throw new UnauthorizedAccessException("This patient record is archived and read-restricted.");

        return ToResponse(patient, careTeamEntry);
    }

    public async Task<PatientResponse> UpdatePatientAsync(Guid patientId, UpdatePatientRequest request, string userId)
    {
        await EnsureAdminAsync(userId, patientId);

        var patient = await _patientRepository.GetByIdAsync(patientId)
                      ?? throw new KeyNotFoundException($"Patient {patientId} not found.");

        // Capture the prior state so we can react to the archive *transition* (active → archived) only,
        // not to every save of an already-archived record.
        var isArchiveTransition = !patient.IsArchived && request.IsArchived;

        patient.FirstName = request.FirstName;
        patient.LastName = request.LastName;
        patient.BirthDate = request.BirthDate;
        // Persist blank optional contact fields as NULL (not "") so they round-trip cleanly through the
        // nullable encrypted columns and are never re-submitted as an invalid empty email.
        patient.Email = NullIfBlank(request.Email);
        patient.PhoneNumber = NullIfBlank(request.PhoneNumber);
        patient.PostalAddress = NullIfBlank(request.PostalAddress);
        patient.IsArchived = request.IsArchived;

        // Cascade: archiving a dossier clears every collaborator's pending notifications for it, so no
        // feed keeps deep-linking to a now read-restricted record. Staged here and committed atomically
        // with the patient update by the single SaveChanges in UpdateAsync (same DbContext). Server-side
        // deletion is sufficient to clear remote feeds — every client re-derives its bell from the
        // unread-notifications endpoint on its next fetch.
        if (isArchiveTransition)
            await _notificationRepository.RemoveByPatientIdAsync(patientId);

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

    public async Task<IEnumerable<CareTeamMemberResponse>> GetCareTeamAsync(Guid patientId, string currentUserId)
    {
        if (!await _careTeamRepository.IsUserInCareTeamAsync(currentUserId, patientId))
            throw new UnauthorizedAccessException("Access to this patient's care team is denied.");

        var members = await _careTeamRepository.GetByPatientIdWithUsersAsync(patientId);
        return members.Select(ToMemberResponse);
    }

    public async Task RemoveCareTeamMemberAsync(Guid patientId, string targetUserId, string currentUserId)
    {
        await EnsureAdminAsync(currentUserId, patientId);

        var membership = await _careTeamRepository.GetForUserAndPatientAsync(targetUserId, patientId)
            ?? throw new KeyNotFoundException($"Care-team member {targetUserId} not found for patient {patientId}.");

        // The patient's administrator (the neuropsychologist) anchors the record and must not be
        // removed — doing so would orphan the patient.
        if (CareTeamRoleResolver.IsAdmin(membership))
            throw new InvalidOperationException("L'administrateur du patient ne peut pas être retiré de l'équipe de soin.");

        _careTeamRepository.Remove(membership);
        await _unitOfWork.SaveChangesAsync();
    }

    public async Task LeaveCareTeamAsync(Guid patientId, string userId)
    {
        var membership = await _careTeamRepository.GetForUserAndPatientAsync(userId, patientId)
            ?? throw new KeyNotFoundException($"Care-team member {userId} not found for patient {patientId}.");

        if (CareTeamRoleResolver.IsAdmin(membership))
            throw new InvalidOperationException("L'administrateur du patient ne peut pas quitter l'équipe de soin.");

        _careTeamRepository.Remove(membership);
        await _unitOfWork.SaveChangesAsync();
    }

    private async Task EnsureAdminAsync(string userId, Guid patientId)
    {
        // No explicit null guard: a missing membership resolves to Collaborator, so a non-member is
        // rejected by the same check as a wrongly-roled member (see CareTeamRoleResolver.Resolve).
        var ct = await _careTeamRepository.GetForUserAndPatientAsync(userId, patientId);
        if (!CareTeamRoleResolver.IsAdmin(ct))
            throw new UnauthorizedAccessException("Only the patient's administrator can perform this action.");
    }

    // Treats a null/empty/whitespace optional field as "no value", normalising it to null.
    private static string? NullIfBlank(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static PatientResponse ToResponse(Patient patient, CareTeam? ct = null) => new()
    {
        Id = patient.Id,
        FirstName = patient.FirstName,
        LastName = patient.LastName,
        BirthDate = patient.BirthDate,
        UserRole = CareTeamRoleResolver.Resolve(ct),
        Email = patient.Email,
        PhoneNumber = patient.PhoneNumber,
        PostalAddress = patient.PostalAddress,
        IsArchived = patient.IsArchived,
    };

    private static CareTeamMemberResponse ToMemberResponse(CareTeam ct) => new()
    {
        UserId = ct.UserId,
        FirstName = ct.User?.FirstName ?? string.Empty,
        LastName = ct.User?.LastName ?? string.Empty,
        // Role is the authorization contract, Relationship is display copy. They are deliberately
        // resolved by two different helpers and must never be swapped: a label is not a permission.
        Role = CareTeamRoleResolver.Resolve(ct),
        Relationship = CareTeamRoleLabels.ForCareTeam(ct),
    };
}
