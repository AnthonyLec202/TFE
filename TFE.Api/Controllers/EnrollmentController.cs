using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TFE.Api.DTOs;
using TFE.Api.Interfaces.IServices;

namespace TFE.Api.Controllers;

[ApiController]
[Route("api/enrollment")]
public class EnrollmentController : ControllerBase
{
    private readonly IEnrollmentService _enrollmentService;

    public EnrollmentController(IEnrollmentService enrollmentService)
    {
        _enrollmentService = enrollmentService;
    }

    [HttpPost("consume")]
    [AllowAnonymous]
    public async Task<IActionResult> ConsumeToken([FromBody] ConsumeTokenRequest request)
    {
        try
        {
            var response = await _enrollmentService.ConsumeTokenAsync(request);
            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
