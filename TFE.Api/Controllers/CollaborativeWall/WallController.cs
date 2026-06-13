using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using TFE.Api.DTOs.CollaborativeWall;
using TFE.Api.Hubs.CollaborativeWall;
using TFE.Api.Interfaces.IServices.CollaborativeWall;
using TFE.Api.Interfaces.IServices.Notifications;

namespace TFE.Api.Controllers.CollaborativeWall;

[ApiController]
[Route("api/patients/{patientId:guid}/wall")]
[Authorize]
public class WallController : ControllerBase
{
    private readonly IWallService _wallService;
    private readonly INotificationService _notificationService;
    private readonly IHubContext<CollaborativeWallHub, ICollaborativeWallClient> _wallHubContext;

    public WallController(
        IWallService wallService,
        INotificationService notificationService,
        IHubContext<CollaborativeWallHub, ICollaborativeWallClient> wallHubContext)
    {
        _wallService = wallService;
        _notificationService = notificationService;
        _wallHubContext = wallHubContext;
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

    [HttpPost("posts/multipart")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> CreatePostWithAttachments(
        Guid patientId, [FromForm] CreatePostFormRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _wallService.CreatePostWithAttachmentsAsync(patientId, CurrentUserId, request, cancellationToken);
            await _wallHubContext.Clients.Group(patientId.ToString()).ReceiveNewPost(response);
            await _notificationService.NotifyNewPostAsync(patientId, CurrentUserId, response);
            return Created($"/api/patients/{patientId}/wall/posts/{response.Id}", response);
        }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (ValidationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("posts")]
    public async Task<IActionResult> CreatePost(Guid patientId, [FromBody] CreatePostRequest request)
    {
        try
        {
            var response = await _wallService.CreatePostAsync(patientId, request, CurrentUserId);
            await _wallHubContext.Clients.Group(patientId.ToString()).ReceiveNewPost(response);
            await _notificationService.NotifyNewPostAsync(patientId, CurrentUserId, response);
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

    [HttpPost("posts/{postId:guid}/comments/multipart")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> CreateCommentWithAttachments(
        Guid patientId, Guid postId, [FromForm] CreateCommentFormRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _wallService.CreateCommentWithAttachmentsAsync(patientId, postId, CurrentUserId, request, cancellationToken);
            await _notificationService.NotifyNewCommentAsync(response.Id);
            return Created(string.Empty, response);
        }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (ValidationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("posts/{postId:guid}/comments")]
    public async Task<IActionResult> CreateComment(Guid patientId, Guid postId, [FromBody] CreateCommentRequest request)
    {
        try
        {
            var response = await _wallService.CreateCommentAsync(postId, request, CurrentUserId);
            await _notificationService.NotifyNewCommentAsync(response.Id);
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
