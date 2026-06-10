using TFE.Api.DTOs.Patients;
using TFE.Api.Interfaces;
using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Interfaces.IServices.Patients;
using TFE.Api.Models;

namespace TFE.Api.Services.Patients;

public class PatientService : IPatientService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPatientRepository _patientRepository;
    private readonly ICareTeamRepository _careTeamRepository;

    public PatientService(
        IUnitOfWork unitOfWork,
        IPatientRepository patientRepository,
        ICareTeamRepository careTeamRepository)
    {
        _unitOfWork = unitOfWork;
        _patientRepository = patientRepository;
        _careTeamRepository = careTeamRepository;
    }

    public async Task<PatientResponse> CreatePatientAsync(CreatePatientRequest request, string currentUserId)
    {
        await using var transaction = await _unitOfWork.BeginTransactionAsync();
        try
        {
            var patient = new Patient
            {
                Id = Guid.NewGuid(),
                FirstName = request.FirstName,
                LastName = request.LastName,
                BirthDate = request.BirthDate,
                CreatedAt = DateTime.UtcNow
            };
            await _patientRepository.CreateAsync(patient);

            var careTeam = new CareTeam
            {
                UserId = currentUserId,
                PatientId = patient.Id,
                Role = RelationshipType.Other,
                CustomRoleName = "Neuropsychologue"
            };
            await _careTeamRepository.CreateAsync(careTeam);

            await transaction.CommitAsync();
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

        // Database-level CASCADE handles CareTeams, EnrollmentTokens, Posts, and Sessions automatically
        await _patientRepository.DeleteAsync(patient);
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
