using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TFE.Api.DTOs;
using TFE.Api.Interfaces.IServices;

namespace TFE.Api.Controllers;

[ApiController]
[Route("api/patients/{patientId:guid}/wall")]
[Authorize]
public class WallController : ControllerBase
{
    private readonly IWallService _wallService;

    public WallController(IWallService wallService)
    {
        _wallService = wallService;
    }

    private string CurrentUserId =>
        User.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? User.FindFirst("sub")?.Value
        ?? throw new InvalidOperationException("Authenticated user ID not found in token.");

    [HttpGet]
    public async Task<IActionResult> GetWall(Guid patientId)
    {
        try
        {
            var posts = await _wallService.GetWallAsync(patientId, CurrentUserId);
            return Ok(posts);
        }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }

    [HttpPost("posts")]
    public async Task<IActionResult> CreatePost(Guid patientId, [FromBody] CreatePostRequest request)
    {
        try
        {
            var response = await _wallService.CreatePostAsync(patientId, request, CurrentUserId);
            return Created($"/api/patients/{patientId}/wall/posts/{response.Id}", response);
        }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }

    [HttpPut("posts/{postId:guid}")]
    public async Task<IActionResult> UpdatePost(Guid patientId, Guid postId, [FromBody] UpdatePostRequest request)
    {
        try
        {
            var response = await _wallService.UpdatePostAsync(postId, request, CurrentUserId);
            return Ok(response);
        }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (KeyNotFoundException) { return NotFound(); }
    }

    [HttpDelete("posts/{postId:guid}")]
    public async Task<IActionResult> DeletePost(Guid patientId, Guid postId)
    {
        try
        {
            await _wallService.DeletePostAsync(postId, CurrentUserId);
            return NoContent();
        }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (KeyNotFoundException) { return NotFound(); }
    }

    [HttpPost("posts/{postId:guid}/comments")]
    public async Task<IActionResult> CreateComment(Guid patientId, Guid postId, [FromBody] CreateCommentRequest request)
    {
        try
        {
            var response = await _wallService.CreateCommentAsync(postId, request, CurrentUserId);
            return Created(string.Empty, response);
        }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (KeyNotFoundException) { return NotFound(); }
    }

    [HttpPut("posts/{postId:guid}/comments/{commentId:guid}")]
    public async Task<IActionResult> UpdateComment(
        Guid patientId, Guid postId, Guid commentId, [FromBody] UpdateCommentRequest request)
    {
        try
        {
            var response = await _wallService.UpdateCommentAsync(commentId, request, CurrentUserId);
            return Ok(response);
        }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (KeyNotFoundException) { return NotFound(); }
    }

    [HttpDelete("posts/{postId:guid}/comments/{commentId:guid}")]
    public async Task<IActionResult> DeleteComment(Guid patientId, Guid postId, Guid commentId)
    {
        try
        {
            await _wallService.DeleteCommentAsync(commentId, CurrentUserId);
            return NoContent();
        }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (KeyNotFoundException) { return NotFound(); }
    }
}
