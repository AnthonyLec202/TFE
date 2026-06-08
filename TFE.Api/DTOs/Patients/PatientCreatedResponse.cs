using System.ComponentModel.DataAnnotations;

namespace TFE.Api.DTOs.Patients;

public class PatientCreatedResponse
{
    [Required] public Guid PatientId { get; set; }
    [Required] public string FirstName { get; set; } = string.Empty;
    [Required] public string LastName { get; set; } = string.Empty;
    [Required] public DateOnly BirthDate { get; set; }
    [Required] public string SecretCode { get; set; } = string.Empty;

    public PatientCreatedResponse() { }

    public PatientCreatedResponse(Guid patientId, string firstName, string lastName,
        DateOnly birthDate, string secretCode)
    {
        PatientId = patientId;
        FirstName = firstName;
        LastName = lastName;
        BirthDate = birthDate;
        SecretCode = secretCode;
    }
}
