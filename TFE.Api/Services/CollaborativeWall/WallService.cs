using System.ComponentModel.DataAnnotations;
using TFE.Api.DTOs.CollaborativeWall;
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
    private readonly IFileStorageService _fileStorage;
    private readonly ILogger<WallService> _logger;
    private readonly string _bucketName;

    public WallService(
        IUnitOfWork unitOfWork,
        IPostRepository postRepository,
        ICommentRepository commentRepository,
        IAttachmentRepository attachmentRepository,
        ICareTeamRepository careTeamRepository,
        IFileStorageService fileStorage,
        IConfiguration configuration,
        ILogger<WallService> logger)
    {
        _unitOfWork = unitOfWork;
        _postRepository = postRepository;
        _commentRepository = commentRepository;
        _attachmentRepository = attachmentRepository;
        _careTeamRepository = careTeamRepository;
        _fileStorage = fileStorage;
        _logger = logger;
        _bucketName = configuration["Supabase:AttachmentsBucket"]
            ?? throw new InvalidOperationException("Supabase:AttachmentsBucket is not configured.");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Task<CareTeam?> GetCareTeamEntryAsync(string userId, Guid patientId)
        => _careTeamRepository.GetForUserAndPatientAsync(userId, patientId);

    private async Task<Dictionary<string, CareTeam>> GetPatientCareTeamMapAsync(Guid patientId)
    {
        var careTeams = await _careTeamRepository.GetByPatientIdWithUsersAsync(patientId);
        return careTeams.ToDictionary(ct => ct.UserId);
    }

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

        var posts = await _postRepository.GetWallForPatientAsync(patientId, isAdmin, userRelationshipRole);

        var responses = new List<PostResponse>(posts.Count);
        foreach (var post in posts)
            responses.Add(await ToPostResponseAsync(post, careTeamMap));
        return responses;
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

        await _postRepository.AddAsync(post);
        await _unitOfWork.SaveChangesAsync();
        var careTeamMap = await GetPatientCareTeamMapAsync(patientId);
        return await ToPostResponseAsync(post, careTeamMap);
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
        return await ToPostResponseAsync(post, careTeamMap);
    }

    public async Task<PostResponse> UpdatePostAsync(Guid postId, UpdatePostRequest request, string currentUserId)
    {
        var post = await _postRepository.GetByIdWithDetailsAsync(postId)
            ?? throw new KeyNotFoundException($"Post {postId} not found.");

        await ValidateModificationRightsAsync(post.CreatedById, post.CreatedAt, post.PatientId, currentUserId);

        var ct = await GetCareTeamEntryAsync(currentUserId, post.PatientId);
        post.Content = request.Content;
        if (ct is not null && ResolveRole(ct) == "Admin")
            post.ExcludedRoles = request.ExcludedRoles;

        post.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync();

        var careTeamMap = await GetPatientCareTeamMapAsync(post.PatientId);
        return await ToPostResponseAsync(post, careTeamMap);
    }

    public async Task DeletePostAsync(Guid postId, string currentUserId)
    {
        var post = await _postRepository.GetByIdWithDetailsAsync(postId)
            ?? throw new KeyNotFoundException($"Post {postId} not found.");

        await ValidateModificationRightsAsync(post.CreatedById, post.CreatedAt, post.PatientId, currentUserId);

        var pathsToDelete = post.Attachments.Select(a => a.StoragePath)
            .Concat(post.Comments.SelectMany(c => c.Attachments.Select(a => a.StoragePath)))
            .ToList();

        _postRepository.Remove(post);
        await _unitOfWork.SaveChangesAsync();

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
        return await ToCommentResponseAsync(comment, careTeamMap);
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
        return await ToCommentResponseAsync(comment, careTeamMap);
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
        return await ToCommentResponseAsync(comment, careTeamMap);
    }

    public async Task DeleteCommentAsync(Guid commentId, string currentUserId)
    {
        var comment = await _commentRepository.GetByIdWithDetailsAsync(commentId)
            ?? throw new KeyNotFoundException($"Comment {commentId} not found.");

        await ValidateModificationRightsAsync(comment.CreatedById, comment.CreatedAt, comment.Post.PatientId, currentUserId);

        var pathsToDelete = comment.Attachments.Select(a => a.StoragePath).ToList();

        _commentRepository.Remove(comment);
        await _unitOfWork.SaveChangesAsync();

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

    private async Task<PostResponse> ToPostResponseAsync(Post post, Dictionary<string, CareTeam> careTeamMap)
    {
        var authorCt = post.CreatedById is { Length: > 0 } postAuthorId
            ? careTeamMap.GetValueOrDefault(postAuthorId)
            : null;
        bool postAuthorDeleted = post.CreatedById is null or { Length: 0 };

        var comments = new List<CommentResponse>(post.Comments.Count);
        foreach (var comment in post.Comments)
            comments.Add(await ToCommentResponseAsync(comment, careTeamMap));

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
            Comments = comments,
            Attachments = await ToAttachmentResponsesAsync(post.Attachments),
        };
    }

    private async Task<CommentResponse> ToCommentResponseAsync(Comment comment, Dictionary<string, CareTeam> careTeamMap)
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
            AuthorRole = commentAuthorDeleted ? string.Empty : LabelForCareTeam(authorCt),
            CreatedAt = comment.CreatedAt,
            UpdatedAt = comment.UpdatedAt,
            Attachments = await ToAttachmentResponsesAsync(comment.Attachments),
        };
    }

    private async Task<List<AttachmentResponse>> ToAttachmentResponsesAsync(IEnumerable<Attachment> attachments)
    {
        var responses = new List<AttachmentResponse>();
        foreach (var a in attachments)
        {
            responses.Add(new AttachmentResponse
            {
                Id = a.Id,
                // A fresh short-lived signed URL is generated at read time from the stored path.
                FileUrl = await _fileStorage.GetSignedUrlAsync(a.StoragePath, _bucketName),
                Filename = a.FileName,
                Filetype = a.FileType,
                PostId = a.PostId,
                CommentId = a.CommentId,
                CreatedAt = a.CreatedAt,
            });
        }
        return responses;
    }
}
