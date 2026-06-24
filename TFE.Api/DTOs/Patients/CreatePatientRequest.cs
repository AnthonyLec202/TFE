using System.ComponentModel.DataAnnotations;

namespace TFE.Api.DTOs.Patients;

public class CreatePatientRequest
{
    // Client-generated identifier (UUID). Enables local-first creation: the client can reference
    // the patient (e.g. link a session) before the record is synced. Falls back to a server-side
    // id when omitted (Guid.Empty).
    public Guid Id { get; set; }

    [Required(ErrorMessage = "First name is required.")]
    [StringLength(100, MinimumLength = 1, ErrorMessage = "First name must be between 1 and 100 characters.")]
    public string FirstName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Last name is required.")]
    [StringLength(100, MinimumLength = 1, ErrorMessage = "Last name must be between 1 and 100 characters.")]
    public string LastName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Birth date is required.")]
    public DateOnly BirthDate { get; set; }

    // Optional — a patient is created active by default; the client never sends this on creation.
    public bool IsArchived { get; set; }
}
