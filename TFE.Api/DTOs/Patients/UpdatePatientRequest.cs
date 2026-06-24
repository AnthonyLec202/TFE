using System.ComponentModel.DataAnnotations;

namespace TFE.Api.DTOs.Patients;

public class UpdatePatientRequest
{
    [Required(ErrorMessage = "First name is required.")]
    [StringLength(100, MinimumLength = 1, ErrorMessage = "First name must be between 1 and 100 characters.")]
    public string FirstName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Last name is required.")]
    [StringLength(100, MinimumLength = 1, ErrorMessage = "Last name must be between 1 and 100 characters.")]
    public string LastName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Birth date is required.")]
    public DateOnly BirthDate { get; set; }

    // Optional contact details — editable only from the dossier, never required.
    [StringLength(254, ErrorMessage = "Email must be at most 254 characters.")]
    [EmailAddress(ErrorMessage = "Email is not a valid address.")]
    public string? Email { get; set; }

    [StringLength(40, ErrorMessage = "Phone number must be at most 40 characters.")]
    public string? PhoneNumber { get; set; }

    [StringLength(250, ErrorMessage = "Postal address must be at most 250 characters.")]
    public string? PostalAddress { get; set; }

    public bool IsArchived { get; set; }
}
