using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TFE.Api.Data;
using TFE.Api.DTOs.CollaborativeWall;
using TFE.Api.Interfaces.IServices.CollaborativeWall;
using TFE.Api.Models;
using TFE.Api.Validators.CollaborativeWall;

namespace TFE.Api.Services.CollaborativeWall;

public class WallService : IWallService
{
    private readonly ApplicationDbContext _context;
    private readonly IFileStorageService _fileStorage;
    private readonly ILogger<WallService> _logger;
    private readonly string _bucketName;

    public WallService(
        ApplicationDbContext context,
        IFileStorageService fileStorage,
        IConfiguration configuration,
        ILogger<WallService> logger)
    {
        _context = context;
        _fileStorage = fileStorage;
        _logger = logger;
        _bucketName = configuration["Supabase:AttachmentsBucket"]
            ?? throw new InvalidOperationException("Supabase:AttachmentsBucket is not configured.");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Task<CareTeam?> GetCareTeamEntryAsync(string userId, Guid patientId)
        => _context.CareTeams.FirstOrDefaultAsync(ct => ct.UserId == userId && ct.PatientId == patientId);

    private Task<Dictionary<string, CareTeam>> GetPatientCareTeamMapAsync(Guid patientId)
        => _context.CareTeams
            .Include(ct => ct.User)
            .Where(ct => ct.PatientId == patientId)
            .ToDictionaryAsync(ct => ct.UserId);

    private static string ResolveRole(CareTeam ct) => ct switch
    {
        { CustomRoleName: "Neuropsychologue" } => "Admin",
        { Role: RelationshipType.Parent }      => "Parent",
        _                                      => "Collaborator"
    };

    // Maps a CareTeam entry to a human-readable French label for display in the feed
    private static string LabelForCareTeam(CareTeam? ct) => ct switch
    {
        { CustomRoleName: "Neuropsychologue" }                   => "Psychologue",
        { Role: RelationshipType.Parent }                        => "Parent",
        { Role: RelationshipType.Teacher }                       => "Enseignant(e)",
        { Role: RelationshipType.SpeechTherapist }               => "Logopède",
        { Role: RelationshipType.PsychomotorTherapist }          => "Psychomotricien(ne)",
        { Role: RelationshipType.Ergotherapist }                 => "Ergothérapeute",
        { Role: RelationshipType.Doctor }                        => "Docteur",
        { CustomRoleName: { Length: > 0 } customName }          => customName,
        not null                                                 => "Collaborateur",
        _                                                        => "Collaborateur"
    };

    // ── Wall (Posts + Comments) ───────────────────────────────────────────────

    public async Task<IEnumerable<PostResponse>> GetWallAsync(Guid patientId, string currentUserId)
    {
        var ct = await GetCareTeamEntryAsync(currentUserId, patientId)
                 ?? throw new UnauthorizedAccessException("Not a member of this patient's care team.");

        var isAdmin = ResolveRole(ct) == "Admin";
        var userRelationshipRole = ct.Role.ToString();

        // Load all CareTeam entries once for efficient author-role resolution
        var careTeamMap = await GetPatientCareTeamMapAsync(patientId);

        var posts = await _context.Posts
            .Where(p => p.PatientId == patientId)
            .Where(p => isAdmin || !p.ExcludedRoles.Any(r => r == userRelationshipRole))
            .Include(p => p.Comments.OrderBy(c => c.CreatedAt))
                .ThenInclude(c => c.Attachments)
            .Include(p => p.Attachments)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        return posts.Select(p => ToPostResponse(p, careTeamMap));
    }

    public async Task<PostResponse> CreatePostAsync(Guid patientId, CreatePostRequest request, string currentUserId)
    {
        var ct = await GetCareTeamEntryAsync(currentUserId, patientId)
                 ?? throw new UnauthorizedAccessException("Not a member of this patient's care team.");

        var excludedRoles = ResolveRole(ct) == "Admin"
            ? request.ExcludedRoles
            : Array.Empty<string>();

        var post = new Post
        {
            Id = Guid.NewGuid(),
            PatientId = patientId,
            Content = request.Content,
            ExcludedRoles = excludedRoles,
            CreatedById = currentUserId,
            CreatedAt = DateTime.UtcNow
        };

        _context.Posts.Add(post);
        await _context.SaveChangesAsync();
        var careTeamMap = await GetPatientCareTeamMapAsync(patientId);
        return ToPostResponse(post, careTeamMap);
    }

    public async Task<PostResponse> CreatePostWithAttachmentsAsync(
        Guid patientId,
        string currentUserId,
        CreatePostFormRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Content) && !(request.Attachments?.Any() ?? false))
            throw new ValidationException("A post must contain either text content or at least one attachment.");

        var ct = await GetCareTeamEntryAsync(currentUserId, patientId)
                 ?? throw new UnauthorizedAccessException("Not a member of this patient's care team.");

        var excludedRoles = ResolveRole(ct) == "Admin"
            ? request.ExcludedRoles
            : Array.Empty<string>();

        // Validate all files before touching storage or the database
        AttachmentValidator.ValidateAll(request.Attachments);

        var post = new Post
        {
            Id = Guid.NewGuid(),
            PatientId = patientId,
            Content = request.Content,
            ExcludedRoles = excludedRoles,
            CreatedById = currentUserId,
            CreatedAt = DateTime.UtcNow,
        };

        _context.Posts.Add(post);

        // Upload each file; if any upload or the DB save fails, roll back all
        // successfully uploaded objects to avoid orphaned files in Supabase Storage.
        var uploadedUrls = new List<string>();
        try
        {
            foreach (var file in request.Attachments ?? [])
            {
                var url = await _fileStorage.UploadFileAsync(file, _bucketName, cancellationToken);
                uploadedUrls.Add(url);

                _context.Attachments.Add(new Attachment
                {
                    Id = Guid.NewGuid(),
                    PostId = post.Id,
                    FileUrl = url,
                    FileName = file.FileName,
                    FileType = file.ContentType,
                    CreatedById = currentUserId,
                    CreatedAt = DateTime.UtcNow,
                });
            }

            await _context.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            // Best-effort cleanup — log failures but do not suppress the original exception
            foreach (var url in uploadedUrls)
            {
                try { await _fileStorage.DeleteFileAsync(url, _bucketName); }
                catch { /* cleanup failure is secondary; original exception is rethrown */ }
            }
            throw;
        }

        // Explicitly load the Attachments navigation property for the response mapping
        await _context.Entry(post).Collection(p => p.Attachments).LoadAsync(cancellationToken);

        var careTeamMap = await GetPatientCareTeamMapAsync(patientId);
        return ToPostResponse(post, careTeamMap);
    }

    public async Task<PostResponse> UpdatePostAsync(Guid postId, UpdatePostRequest request, string currentUserId)
    {
        var post = await _context.Posts
            .Include(p => p.Comments.OrderBy(c => c.CreatedAt))
                .ThenInclude(c => c.Attachments)
            .Include(p => p.Attachments)
            .FirstOrDefaultAsync(p => p.Id == postId)
            ?? throw new KeyNotFoundException($"Post {postId} not found.");

        await ValidateModificationRightsAsync(post.CreatedById, post.CreatedAt, post.PatientId, currentUserId);

        var ct = await GetCareTeamEntryAsync(currentUserId, post.PatientId);
        post.Content = request.Content;
        if (ct is not null && ResolveRole(ct) == "Admin")
            post.ExcludedRoles = request.ExcludedRoles;

        post.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var careTeamMap = await GetPatientCareTeamMapAsync(post.PatientId);
        return ToPostResponse(post, careTeamMap);
    }

    public async Task DeletePostAsync(Guid postId, string currentUserId)
    {
        var post = await _context.Posts
            .Include(p => p.Attachments)
            .Include(p => p.Comments)
                .ThenInclude(c => c.Attachments)
            .FirstOrDefaultAsync(p => p.Id == postId)
            ?? throw new KeyNotFoundException($"Post {postId} not found.");

        await ValidateModificationRightsAsync(post.CreatedById, post.CreatedAt, post.PatientId, currentUserId);

        var urlsToDelete = post.Attachments.Select(a => a.FileUrl)
            .Concat(post.Comments.SelectMany(c => c.Attachments.Select(a => a.FileUrl)))
            .ToList();

        _context.Posts.Remove(post);
        await _context.SaveChangesAsync();

        foreach (var url in urlsToDelete)
        {
            try { await _fileStorage.DeleteFileAsync(url, _bucketName); }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete orphan file from storage: {Url}", url);
            }
        }
    }

    public async Task<CommentResponse> CreateCommentAsync(Guid postId, CreateCommentRequest request, string currentUserId)
    {
        var post = await _context.Posts.FirstOrDefaultAsync(p => p.Id == postId)
                   ?? throw new KeyNotFoundException($"Post {postId} not found.");

        var ct = await GetCareTeamEntryAsync(currentUserId, post.PatientId)
                 ?? throw new UnauthorizedAccessException("Not a member of this patient's care team.");

        var comment = new Comment
        {
            Id = Guid.NewGuid(),
            PostId = postId,
            Content = request.Content,
            CreatedById = currentUserId,
            CreatedAt = DateTime.UtcNow
        };

        _context.Comments.Add(comment);
        await _context.SaveChangesAsync();
        var careTeamMap = await GetPatientCareTeamMapAsync(post.PatientId);
        return ToCommentResponse(comment, careTeamMap);
    }

    public async Task<CommentResponse> UpdateCommentAsync(Guid commentId, UpdateCommentRequest request, string currentUserId)
    {
        var comment = await _context.Comments
            .Include(c => c.Post)
            .Include(c => c.Attachments)
            .FirstOrDefaultAsync(c => c.Id == commentId)
            ?? throw new KeyNotFoundException($"Comment {commentId} not found.");

        await ValidateModificationRightsAsync(comment.CreatedById, comment.CreatedAt, comment.Post.PatientId, currentUserId);
        comment.Content = request.Content;
        comment.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var careTeamMap = await GetPatientCareTeamMapAsync(comment.Post.PatientId);
        return ToCommentResponse(comment, careTeamMap);
    }

    public async Task DeleteCommentAsync(Guid commentId, string currentUserId)
    {
        var comment = await _context.Comments
            .Include(c => c.Post)
            .Include(c => c.Attachments)
            .FirstOrDefaultAsync(c => c.Id == commentId)
            ?? throw new KeyNotFoundException($"Comment {commentId} not found.");

        await ValidateModificationRightsAsync(comment.CreatedById, comment.CreatedAt, comment.Post.PatientId, currentUserId);

        var urlsToDelete = comment.Attachments.Select(a => a.FileUrl).ToList();

        _context.Comments.Remove(comment);
        await _context.SaveChangesAsync();

        foreach (var url in urlsToDelete)
        {
            try { await _fileStorage.DeleteFileAsync(url, _bucketName); }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete orphan file from storage: {Url}", url);
            }
        }
    }

    // ── RBAC core: 24-hour rule ───────────────────────────────────────────────

    private async Task ValidateModificationRightsAsync(
        string? entityCreatedById,
        DateTime entityCreatedAt,
        Guid patientId,
        string currentUserId)
    {
        var ct = await GetCareTeamEntryAsync(currentUserId, patientId)
                 ?? throw new UnauthorizedAccessException("Not a member of this patient's care team.");

        if (ResolveRole(ct) == "Admin") return;

        // Null createdById means the original author's account was deleted — only admins may act.
        if (entityCreatedById is null || entityCreatedById != currentUserId)
            throw new UnauthorizedAccessException("You can only modify your own content.");

        if ((DateTime.UtcNow - entityCreatedAt).TotalHours > 24)
            throw new UnauthorizedAccessException("Action allowed only for admins or within 24 hours of creation.");
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private static PostResponse ToPostResponse(Post post, Dictionary<string, CareTeam> careTeamMap)
    {
        var authorCt = post.CreatedById is { Length: > 0 } postAuthorId
            ? careTeamMap.GetValueOrDefault(postAuthorId)
            : null;
        bool postAuthorDeleted = post.CreatedById is null or { Length: 0 };

        return new PostResponse
        {
            Id = post.Id,
            PatientId = post.PatientId,
            Content = post.Content ?? string.Empty,
            ExcludedRoles = post.ExcludedRoles,
            CreatedById = post.CreatedById,
            AuthorFirstName = postAuthorDeleted ? string.Empty : (!string.IsNullOrWhiteSpace(authorCt?.User?.FirstName) ? authorCt!.User!.FirstName : "Utilisateur"),
            AuthorLastName = postAuthorDeleted ? string.Empty : (!string.IsNullOrWhiteSpace(authorCt?.User?.LastName) ? authorCt!.User!.LastName : "Inconnu"),
            AuthorRole = postAuthorDeleted ? string.Empty : LabelForCareTeam(authorCt),
            CreatedAt = post.CreatedAt,
            UpdatedAt = post.UpdatedAt,
            Comments = post.Comments.Select(c => ToCommentResponse(c, careTeamMap)).ToList(),
            Attachments = post.Attachments.Select(ToAttachmentResponse).ToList(),
        };
    }

    private static CommentResponse ToCommentResponse(Comment comment, Dictionary<string, CareTeam> careTeamMap)
    {
        var authorCt = comment.CreatedById is { Length: > 0 } commentAuthorId
            ? careTeamMap.GetValueOrDefault(commentAuthorId)
            : null;
        bool commentAuthorDeleted = comment.CreatedById is null or { Length: 0 };

        return new CommentResponse
        {
            Id = comment.Id,
            PostId = comment.PostId,
            Content = comment.Content,
            CreatedById = comment.CreatedById,
            AuthorFirstName = commentAuthorDeleted ? string.Empty : (!string.IsNullOrWhiteSpace(authorCt?.User?.FirstName) ? authorCt!.User!.FirstName : "Utilisateur"),
            AuthorLastName = commentAuthorDeleted ? string.Empty : (!string.IsNullOrWhiteSpace(authorCt?.User?.LastName) ? authorCt!.User!.LastName : "Inconnu"),
            AuthorRole = commentAuthorDeleted ? string.Empty : LabelForCareTeam(authorCt),
            CreatedAt = comment.CreatedAt,
            UpdatedAt = comment.UpdatedAt,
            Attachments = comment.Attachments.Select(ToAttachmentResponse).ToList(),
        };
    }

    private static AttachmentResponse ToAttachmentResponse(Attachment a) => new()
    {
        Id = a.Id,
        FileUrl = a.FileUrl,
        Filename = a.FileName,
        Filetype = a.FileType,
        PostId = a.PostId,
        CommentId = a.CommentId,
        CreatedAt = a.CreatedAt,
    };
}
