using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.SignalR;
using TFE.Api.DTOs.CollaborativeWall;
using TFE.Api.Exceptions;
using TFE.Api.Hubs.CollaborativeWall;
using TFE.Api.Interfaces;
using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Interfaces.IServices.CollaborativeWall;
using TFE.Api.Models;
using TFE.Api.Validators.CollaborativeWall;

namespace TFE.Api.Services.CollaborativeWall;

public class WallService : IWallService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPostRepository _postRepository;
    private readonly ICommentRepository _commentRepository;
    private readonly IAttachmentRepository _attachmentRepository;
    private readonly ICareTeamRepository _careTeamRepository;
    private readonly IPatientRepository _patientRepository;
    private readonly IFileStorageService _fileStorage;
    private readonly IHubContext<CollaborativeWallHub, ICollaborativeWallClient> _hubContext;
    private readonly ILogger<WallService> _logger;
    private readonly string _bucketName;

    public WallService(
        IUnitOfWork unitOfWork,
        IPostRepository postRepository,
        ICommentRepository commentRepository,
        IAttachmentRepository attachmentRepository,
        ICareTeamRepository careTeamRepository,
        IPatientRepository patientRepository,
        IFileStorageService fileStorage,
        IHubContext<CollaborativeWallHub, ICollaborativeWallClient> hubContext,
        IConfiguration configuration,
        ILogger<WallService> logger)
    {
        _unitOfWork = unitOfWork;
        _postRepository = postRepository;
        _commentRepository = commentRepository;
        _attachmentRepository = attachmentRepository;
        _careTeamRepository = careTeamRepository;
        _patientRepository = patientRepository;
        _fileStorage = fileStorage;
        _hubContext = hubContext;
        _logger = logger;
        _bucketName = configuration["Supabase:AttachmentsBucket"]
            ?? throw new InvalidOperationException("Supabase:AttachmentsBucket is not configured.");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Task<CareTeam?> GetCareTeamEntryAsync(string userId, Guid patientId)
        => _careTeamRepository.GetForUserAndPatientAsync(userId, patientId);

    // Read-only guard: an archived patient's wall accepts no writes (new posts/comments, edits,
    // deletes). Throwing here also short-circuits the controller before it reaches the notification
    // dispatcher, so no notification is ever emitted for an archived dossier.
    private async Task EnsurePatientNotArchivedAsync(Guid patientId)
    {
        var patient = await _patientRepository.GetByIdAsync(patientId)
            ?? throw new KeyNotFoundException($"Patient {patientId} not found.");

        if (patient.IsArchived)
            throw new ArchivedPatientException("Ce dossier est archivé : le mur est en lecture seule.");
    }

    private async Task<Dictionary<string, CareTeam>> GetPatientCareTeamMapAsync(Guid patientId)
    {
        var careTeams = await _careTeamRepository.GetByPatientIdWithUsersAsync(patientId);
        return careTeams.ToDictionary(ct => ct.UserId);
    }

    // ── Real-time fan-out ─────────────────────────────────────────────────────

    public async Task<string?> ResolveWallGroupAsync(string userId, Guid patientId)
    {
        var careTeam = await GetCareTeamEntryAsync(userId, patientId);
        return careTeam is null ? null : WallGroups.For(patientId, RoleSegmentFor(careTeam));
    }

    // The managing psychologist reads every post whatever its exclusion set (see GetWallAsync), so
    // they hold a segment of their own. Everyone else is keyed by the relationship role, which is the
    // exact value ExcludedRoles is compared against.
    private static string RoleSegmentFor(CareTeam careTeam)
        => CareTeamRoleResolver.IsAdmin(careTeam)
            ? WallGroups.AdminSegment
            : careTeam.Role.ToString();

    // The groups entitled to an event about a post carrying this exclusion set. Mirrors
    // PostRepository.GetWallForPatientAsync so the live channel and the HTTP read can never disagree.
    // Enumerating the roles rather than loading the care team keeps the fan-out query-free.
    private static IEnumerable<string> VisibleGroups(Guid patientId, IReadOnlyCollection<string> excludedRoles)
    {
        yield return WallGroups.For(patientId, WallGroups.AdminSegment);

        foreach (var role in Enum.GetValues<RelationshipType>())
        {
            var roleName = role.ToString();
            if (!excludedRoles.Contains(roleName))
                yield return WallGroups.For(patientId, roleName);
        }
    }

    private async Task BroadcastAsync(
        Guid patientId,
        IReadOnlyCollection<string> excludedRoles,
        Func<ICollaborativeWallClient, Task> send)
    {
        foreach (var group in VisibleGroups(patientId, excludedRoles))
            await send(_hubContext.Clients.Group(group));
    }

    // An edit may itself change who the post is visible to, so a single ReceiveUpdatedPost to the new
    // audience is not enough. Members who lost access are told to drop it — they would otherwise keep
    // rendering stale content until a reload — and members who gained access receive it as a new post,
    // ReceiveUpdatedPost being a no-op on a client that never held it.
    private async Task BroadcastPostVisibilityChangeAsync(
        PostResponse post,
        IReadOnlyCollection<string> previousExcludedRoles)
    {
        var previousAudience = VisibleGroups(post.PatientId, previousExcludedRoles).ToHashSet();
        var currentAudience = VisibleGroups(post.PatientId, post.ExcludedRoles).ToHashSet();

        foreach (var group in currentAudience.Intersect(previousAudience))
            await _hubContext.Clients.Group(group).ReceiveUpdatedPost(post);

        foreach (var group in currentAudience.Except(previousAudience))
            await _hubContext.Clients.Group(group).ReceiveNewPost(post);

        foreach (var group in previousAudience.Except(currentAudience))
            await _hubContext.Clients.Group(group).ReceiveDeletedPost(post.Id);
    }

    // ── Wall (Posts + Comments) ───────────────────────────────────────────────

    public async Task<IEnumerable<PostResponse>> GetWallAsync(Guid patientId, string currentUserId)
    {
        var ct = await GetCareTeamEntryAsync(currentUserId, patientId)
                 ?? throw new UnauthorizedAccessException("Not a member of this patient's care team.");

        var isAdmin = CareTeamRoleResolver.IsAdmin(ct);

        // RBAC cascade: an archived patient's wall is readable only by the managing psychologist
        // (Admin). Other roles are denied even with care-team membership, blocking direct API fetches.
        if (!isAdmin)
        {
            var patient = await _patientRepository.GetByIdAsync(patientId)
                ?? throw new KeyNotFoundException($"Patient {patientId} not found.");
            if (patient.IsArchived)
                throw new UnauthorizedAccessException("This patient record is archived and read-restricted.");
        }

        var userRelationshipRole = ct.Role.ToString();

        // Load all CareTeam entries once for efficient author-role resolution
        var careTeamMap = await GetPatientCareTeamMapAsync(patientId);

        var posts = await _postRepository.GetWallForPatientAsync(patientId, isAdmin, userRelationshipRole);

        // Sign every attachment of the whole wall in a single round-trip, then map synchronously.
        var signedUrls = await BuildSignedUrlMapAsync(posts);

        return posts.Select(post => ToPostResponse(post, careTeamMap, signedUrls)).ToList();
    }

    public async Task<PostResponse> CreatePostAsync(Guid patientId, CreatePostRequest request, string currentUserId)
    {
        await EnsurePatientNotArchivedAsync(patientId);

        var ct = await GetCareTeamEntryAsync(currentUserId, patientId)
                 ?? throw new UnauthorizedAccessException("Not a member of this patient's care team.");

        var excludedRoles = CareTeamRoleResolver.IsAdmin(ct)
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

        await _postRepository.AddAsync(post);
        await _unitOfWork.SaveChangesAsync();
        var careTeamMap = await GetPatientCareTeamMapAsync(patientId);
        var signedUrls = await BuildSignedUrlMapAsync([post]);

        var response = ToPostResponse(post, careTeamMap, signedUrls);
        await BroadcastAsync(patientId, response.ExcludedRoles, client => client.ReceiveNewPost(response));
        return response;
    }

    public async Task<PostResponse> CreatePostWithAttachmentsAsync(
        Guid patientId,
        string currentUserId,
        CreatePostFormRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Content) && !(request.Attachments?.Any() ?? false))
            throw new ValidationException("A post must contain either text content or at least one attachment.");

        await EnsurePatientNotArchivedAsync(patientId);

        var ct = await GetCareTeamEntryAsync(currentUserId, patientId)
                 ?? throw new UnauthorizedAccessException("Not a member of this patient's care team.");

        var excludedRoles = CareTeamRoleResolver.IsAdmin(ct)
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

        await _postRepository.AddAsync(post);

        // Upload each file; if any upload or the DB save fails, roll back all
        // successfully uploaded objects to avoid orphaned files in Supabase Storage.
        var uploadedPaths = new List<string>();
        try
        {
            foreach (var file in request.Attachments ?? [])
            {
                var storagePath = await _fileStorage.UploadFileAsync(file, _bucketName, cancellationToken);
                uploadedPaths.Add(storagePath);

                await _attachmentRepository.AddAsync(new Attachment
                {
                    Id = Guid.NewGuid(),
                    PostId = post.Id,
                    StoragePath = storagePath,
                    FileName = file.FileName,
                    FileType = file.ContentType,
                    CreatedById = currentUserId,
                    CreatedAt = DateTime.UtcNow,
                });
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            // Best-effort cleanup — log failures but do not suppress the original exception
            foreach (var path in uploadedPaths)
            {
                try { await _fileStorage.DeleteFileAsync(path, _bucketName); }
                catch { /* cleanup failure is secondary; original exception is rethrown */ }
            }
            throw;
        }

        // Explicitly load the Attachments navigation property for the response mapping
        await _postRepository.LoadAttachmentsAsync(post, cancellationToken);

        var careTeamMap = await GetPatientCareTeamMapAsync(patientId);
        var signedUrls = await BuildSignedUrlMapAsync([post]);

        var response = ToPostResponse(post, careTeamMap, signedUrls);
        await BroadcastAsync(patientId, response.ExcludedRoles, client => client.ReceiveNewPost(response));
        return response;
    }

    public async Task<PostResponse> UpdatePostAsync(Guid postId, UpdatePostRequest request, string currentUserId)
    {
        var post = await _postRepository.GetByIdWithDetailsAsync(postId)
            ?? throw new KeyNotFoundException($"Post {postId} not found.");

        await ValidateModificationRightsAsync(post.CreatedById, post.CreatedAt, post.PatientId, currentUserId);

        var ct = await GetCareTeamEntryAsync(currentUserId, post.PatientId);

        // Captured before the assignment below: an admin edit may widen or narrow the audience, and
        // the fan-out needs both sets to tell a newly-included member from a newly-excluded one.
        var previousExcludedRoles = post.ExcludedRoles;

        post.Content = request.Content;
        if (CareTeamRoleResolver.IsAdmin(ct))
            post.ExcludedRoles = request.ExcludedRoles;

        post.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync();

        var careTeamMap = await GetPatientCareTeamMapAsync(post.PatientId);
        var signedUrls = await BuildSignedUrlMapAsync([post]);

        var response = ToPostResponse(post, careTeamMap, signedUrls);
        await BroadcastPostVisibilityChangeAsync(response, previousExcludedRoles);
        return response;
    }

    public async Task DeletePostAsync(Guid postId, string currentUserId)
    {
        var post = await _postRepository.GetByIdWithDetailsAsync(postId)
            ?? throw new KeyNotFoundException($"Post {postId} not found.");

        await ValidateModificationRightsAsync(post.CreatedById, post.CreatedAt, post.PatientId, currentUserId);

        var pathsToDelete = post.Attachments.Select(a => a.StoragePath)
            .Concat(post.Comments.SelectMany(c => c.Attachments.Select(a => a.StoragePath)))
            .ToList();

        // Captured before removal: the deletion event is addressed to the audience the post had.
        var patientId = post.PatientId;
        var excludedRoles = post.ExcludedRoles;

        _postRepository.Remove(post);
        await _unitOfWork.SaveChangesAsync();

        await BroadcastAsync(patientId, excludedRoles, client => client.ReceiveDeletedPost(postId));

        foreach (var path in pathsToDelete)
        {
            try { await _fileStorage.DeleteFileAsync(path, _bucketName); }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete orphan file from storage: {Path}", path);
            }
        }
    }

    public async Task<CommentResponse> CreateCommentAsync(Guid postId, CreateCommentRequest request, string currentUserId)
    {
        var post = await _postRepository.GetByIdAsync(postId)
                   ?? throw new KeyNotFoundException($"Post {postId} not found.");

        await EnsurePatientNotArchivedAsync(post.PatientId);

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

        await _commentRepository.AddAsync(comment);
        await _unitOfWork.SaveChangesAsync();
        var careTeamMap = await GetPatientCareTeamMapAsync(post.PatientId);
        var signedUrls = await BuildSignedUrlMapAsync(comment);

        var response = ToCommentResponse(comment, careTeamMap, signedUrls);
        await BroadcastAsync(post.PatientId, post.ExcludedRoles, client => client.ReceiveNewComment(response));
        return response;
    }

    public async Task<CommentResponse> CreateCommentWithAttachmentsAsync(
        Guid patientId,
        Guid postId,
        string currentUserId,
        CreateCommentFormRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Content) && !(request.Attachments?.Any() ?? false))
            throw new ValidationException("A comment must contain either text content or at least one attachment.");

        var post = await _postRepository.GetByIdAsync(postId, cancellationToken)
                   ?? throw new KeyNotFoundException($"Post {postId} not found.");

        await EnsurePatientNotArchivedAsync(post.PatientId);

        _ = await GetCareTeamEntryAsync(currentUserId, post.PatientId)
            ?? throw new UnauthorizedAccessException("Not a member of this patient's care team.");

        AttachmentValidator.ValidateAll(request.Attachments);

        var comment = new Comment
        {
            Id = Guid.NewGuid(),
            PostId = postId,
            Content = request.Content,
            CreatedById = currentUserId,
            CreatedAt = DateTime.UtcNow,
        };

        await _commentRepository.AddAsync(comment);

        var uploadedPaths = new List<string>();
        try
        {
            foreach (var file in request.Attachments ?? [])
            {
                var storagePath = await _fileStorage.UploadFileAsync(file, _bucketName, cancellationToken);
                uploadedPaths.Add(storagePath);

                await _attachmentRepository.AddAsync(new Attachment
                {
                    Id = Guid.NewGuid(),
                    CommentId = comment.Id,
                    StoragePath = storagePath,
                    FileName = file.FileName,
                    FileType = file.ContentType,
                    CreatedById = currentUserId,
                    CreatedAt = DateTime.UtcNow,
                });
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            foreach (var path in uploadedPaths)
            {
                try { await _fileStorage.DeleteFileAsync(path, _bucketName); }
                catch { /* cleanup failure is secondary; original exception is rethrown */ }
            }
            throw;
        }

        await _commentRepository.LoadAttachmentsAsync(comment, cancellationToken);

        var careTeamMap = await GetPatientCareTeamMapAsync(post.PatientId);
        var signedUrls = await BuildSignedUrlMapAsync(comment);

        var response = ToCommentResponse(comment, careTeamMap, signedUrls);
        await BroadcastAsync(post.PatientId, post.ExcludedRoles, client => client.ReceiveNewComment(response));
        return response;
    }

    public async Task<CommentResponse> UpdateCommentAsync(Guid commentId, UpdateCommentRequest request, string currentUserId)
    {
        var comment = await _commentRepository.GetByIdWithDetailsAsync(commentId)
            ?? throw new KeyNotFoundException($"Comment {commentId} not found.");

        await ValidateModificationRightsAsync(comment.CreatedById, comment.CreatedAt, comment.Post.PatientId, currentUserId);
        comment.Content = request.Content;
        comment.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync();

        var careTeamMap = await GetPatientCareTeamMapAsync(comment.Post.PatientId);
        var signedUrls = await BuildSignedUrlMapAsync(comment);

        var response = ToCommentResponse(comment, careTeamMap, signedUrls);
        await BroadcastAsync(
            comment.Post.PatientId, comment.Post.ExcludedRoles, client => client.ReceiveUpdatedComment(response));
        return response;
    }

    public async Task DeleteCommentAsync(Guid commentId, string currentUserId)
    {
        var comment = await _commentRepository.GetByIdWithDetailsAsync(commentId)
            ?? throw new KeyNotFoundException($"Comment {commentId} not found.");

        await ValidateModificationRightsAsync(comment.CreatedById, comment.CreatedAt, comment.Post.PatientId, currentUserId);

        var pathsToDelete = comment.Attachments.Select(a => a.StoragePath).ToList();

        // Captured before removal: same audience rule as the parent post.
        var postId = comment.PostId;
        var patientId = comment.Post.PatientId;
        var excludedRoles = comment.Post.ExcludedRoles;

        _commentRepository.Remove(comment);
        await _unitOfWork.SaveChangesAsync();

        await BroadcastAsync(
            patientId, excludedRoles, client => client.ReceiveDeletedComment(postId, commentId));

        foreach (var path in pathsToDelete)
        {
            try { await _fileStorage.DeleteFileAsync(path, _bucketName); }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete orphan file from storage: {Path}", path);
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
        // Archived dossiers are read-only: no edits or deletes of existing posts/comments either.
        await EnsurePatientNotArchivedAsync(patientId);

        var ct = await GetCareTeamEntryAsync(currentUserId, patientId)
                 ?? throw new UnauthorizedAccessException("Not a member of this patient's care team.");

        if (CareTeamRoleResolver.IsAdmin(ct)) return;

        // Null createdById means the original author's account was deleted — only admins may act.
        if (entityCreatedById is null || entityCreatedById != currentUserId)
            throw new UnauthorizedAccessException("You can only modify your own content.");

        if ((DateTime.UtcNow - entityCreatedAt).TotalHours > 24)
            throw new UnauthorizedAccessException("Action allowed only for admins or within 24 hours of creation.");
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    // Signs every attachment across the given posts (and their comments) in one batch request.
    private Task<IReadOnlyDictionary<string, string>> BuildSignedUrlMapAsync(IReadOnlyCollection<Post> posts)
    {
        var paths = posts
            .SelectMany(p => p.Attachments.Select(a => a.StoragePath)
                .Concat(p.Comments.SelectMany(c => c.Attachments.Select(a => a.StoragePath))))
            .Where(path => !string.IsNullOrEmpty(path))
            .ToList();
        return _fileStorage.GetSignedUrlsAsync(paths, _bucketName);
    }

    // Signs a single comment's attachments in one batch request.
    private Task<IReadOnlyDictionary<string, string>> BuildSignedUrlMapAsync(Comment comment)
    {
        var paths = comment.Attachments
            .Select(a => a.StoragePath)
            .Where(path => !string.IsNullOrEmpty(path))
            .ToList();
        return _fileStorage.GetSignedUrlsAsync(paths, _bucketName);
    }

    private static PostResponse ToPostResponse(
        Post post, Dictionary<string, CareTeam> careTeamMap, IReadOnlyDictionary<string, string> signedUrls)
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
            AuthorRole = postAuthorDeleted ? string.Empty : CareTeamRoleLabels.ForCareTeam(authorCt),
            CreatedAt = post.CreatedAt,
            UpdatedAt = post.UpdatedAt,
            Comments = post.Comments.Select(c => ToCommentResponse(c, careTeamMap, signedUrls)).ToList(),
            Attachments = post.Attachments.Select(a => ToAttachmentResponse(a, signedUrls)).ToList(),
        };
    }

    private static CommentResponse ToCommentResponse(
        Comment comment, Dictionary<string, CareTeam> careTeamMap, IReadOnlyDictionary<string, string> signedUrls)
    {
        var authorCt = comment.CreatedById is { Length: > 0 } commentAuthorId
            ? careTeamMap.GetValueOrDefault(commentAuthorId)
            : null;
        bool commentAuthorDeleted = comment.CreatedById is null or { Length: 0 };

        return new CommentResponse
        {
            Id = comment.Id,
            PostId = comment.PostId,
            Content = comment.Content ?? string.Empty,
            CreatedById = comment.CreatedById,
            AuthorFirstName = commentAuthorDeleted ? string.Empty : (!string.IsNullOrWhiteSpace(authorCt?.User?.FirstName) ? authorCt!.User!.FirstName : "Utilisateur"),
            AuthorLastName = commentAuthorDeleted ? string.Empty : (!string.IsNullOrWhiteSpace(authorCt?.User?.LastName) ? authorCt!.User!.LastName : "Inconnu"),
            AuthorRole = commentAuthorDeleted ? string.Empty : CareTeamRoleLabels.ForCareTeam(authorCt),
            CreatedAt = comment.CreatedAt,
            UpdatedAt = comment.UpdatedAt,
            Attachments = comment.Attachments.Select(a => ToAttachmentResponse(a, signedUrls)).ToList(),
        };
    }

    private static AttachmentResponse ToAttachmentResponse(Attachment a, IReadOnlyDictionary<string, string> signedUrls) => new()
    {
        Id = a.Id,
        // Signed URL resolved from the pre-computed batch map (empty if it could not be signed).
        FileUrl = signedUrls.GetValueOrDefault(a.StoragePath, string.Empty),
        Filename = a.FileName,
        Filetype = a.FileType,
        PostId = a.PostId,
        CommentId = a.CommentId,
        CreatedAt = a.CreatedAt,
    };
}
