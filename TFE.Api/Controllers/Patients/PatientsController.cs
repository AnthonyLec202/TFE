using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TFE.Api.DTOs.Invitations;
using TFE.Api.DTOs.Patients;
using TFE.Api.Interfaces.IServices.Auth;
using TFE.Api.Interfaces.IServices.Patients;

namespace TFE.Api.Controllers.Patients;

[ApiController]
[Route("api/patients")]
[Authorize]
public class PatientsController : ControllerBase
{
    private readonly IPatientService _patientService;
    private readonly IEnrollmentService _enrollmentService;

    public PatientsController(IPatientService patientService, IEnrollmentService enrollmentService)
    {
        _patientService = patientService;
        _enrollmentService = enrollmentService;
    }

    private string CurrentUserId =>
        User.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? User.FindFirst("sub")?.Value
        ?? throw new InvalidOperationException("Authenticated user ID not found in token.");

    [HttpGet]
    public async Task<IActionResult> GetPatients()
    {
        var patients = await _patientService.GetPatientsForUserAsync(CurrentUserId);
        return Ok(patients);
    }

    [HttpPost]
    public async Task<IActionResult> CreatePatient([FromBody] CreatePatientRequest request)
    {
        var response = await _patientService.CreatePatientAsync(request, CurrentUserId);
        return Created($"/api/patients/{response.Id}", response);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetPatient(Guid id)
    {
        try
        {
            var response = await _patientService.GetPatientByIdAsync(id, CurrentUserId);
            return Ok(response);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdatePatient(Guid id, [FromBody] UpdatePatientRequest request)
    {
        try
        {
            var response = await _patientService.UpdatePatientAsync(id, request, CurrentUserId);
            return Ok(response);
        }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (KeyNotFoundException) { return NotFound(); }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeletePatient(Guid id)
    {
        try
        {
            await _patientService.DeletePatientAsync(id, CurrentUserId);
            return NoContent();
        }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (KeyNotFoundException) { return NotFound(); }
    }

    [HttpPost("{id:guid}/invitations")]
    public async Task<IActionResult> GenerateInvitation(Guid id, [FromBody] GenerateInvitationRequest request)
    {
        try
        {
            var response = await _enrollmentService.GenerateInvitationAsync(id, request.RoleTarget, CurrentUserId);
            return Ok(response);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
