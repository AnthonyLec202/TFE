using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TFE.Api.DTOs.ClinicalTools;
using TFE.Api.Interfaces.IServices.ClinicalTools;
using TFE.Api.Models;

namespace TFE.Api.Controllers.ClinicalTools;

[ApiController]
[Route("api/therapeutic-tools")]
[Authorize(Roles = "Admin")]
public class TherapeuticToolsController : ControllerBase
{
    private readonly ITherapeuticToolService _toolService;

    public TherapeuticToolsController(ITherapeuticToolService toolService)
    {
        _toolService = toolService;
    }

    [HttpGet]
    public async Task<ActionResult<List<TherapeuticToolResponse>>> GetAll(
        [FromQuery] string? query,
        [FromQuery] ToolType? type,
        [FromQuery] CbtTheme? theme,
        CancellationToken cancellationToken)
        => Ok(await _toolService.GetAllAsync(query, type, theme, cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TherapeuticToolResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var tool = await _toolService.GetByIdAsync(id, cancellationToken);
        return tool is null ? NotFound() : Ok(tool);
    }

    [HttpPost]
    public async Task<ActionResult<TherapeuticToolResponse>> Create(
        [FromBody] CreateTherapeuticToolRequest request,
        CancellationToken cancellationToken)
    {
        var tool = await _toolService.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = tool.Id }, tool);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateTherapeuticToolRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            await _toolService.UpdateAsync(id, request, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            await _toolService.DeleteAsync(id, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }
}
