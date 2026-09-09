using Microsoft.AspNetCore.Identity;
using TFE.Api.Interfaces;
using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Interfaces.IServices.CollaborativeWall;
using TFE.Api.Interfaces.IServices.Patients;
using TFE.Api.Models;

namespace TFE.Api.Services.Patients;

public class UserService : IUserService
{
    private const string DeletedContent = "Compte supprimé - Contenu invisible";

    private readonly IUnitOfWork _unitOfWork;
    private readonly IPostRepository _postRepository;
    private readonly ICommentRepository _commentRepository;
    private readonly IAttachmentRepository _attachmentRepository;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IFileStorageService _fileStorage;
    private readonly string _bucketName;

    public UserService(
        IUnitOfWork unitOfWork,
        IPostRepository postRepository,
        ICommentRepository commentRepository,
        IAttachmentRepository attachmentRepository,
        UserManager<ApplicationUser> userManager,
        IFileStorageService fileStorage,
        IConfiguration configuration)
    {
        _unitOfWork = unitOfWork;
        _postRepository = postRepository;
        _commentRepository = commentRepository;
        _attachmentRepository = attachmentRepository;
        _userManager = userManager;
        _fileStorage = fileStorage;
        _bucketName = configuration["Supabase:AttachmentsBucket"]
            ?? throw new InvalidOperationException("Supabase:AttachmentsBucket is not configured.");
    }

    public async Task DeleteUserAsync(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId)
            ?? throw new KeyNotFoundException("Utilisateur introuvable.");

        await using var transaction = await _unitOfWork.BeginTransactionAsync();
        try
        {
            var posts = await _postRepository.GetByAuthorWithAttachmentsAsync(userId);
            var comments = await _commentRepository.GetByAuthorWithAttachmentsAsync(userId);

            foreach (var post in posts)
            {
                foreach (var att in post.Attachments)
                {
                    await _fileStorage.DeleteFileAsync(att.StoragePath, _bucketName);
                    _attachmentRepository.Remove(att);
                }
                post.Content = DeletedContent;
            }

            foreach (var comment in comments)
            {
                foreach (var att in comment.Attachments)
                {
                    await _fileStorage.DeleteFileAsync(att.StoragePath, _bucketName);
                    _attachmentRepository.Remove(att);
                }
                comment.Content = DeletedContent;
            }

            await _unitOfWork.SaveChangesAsync();

            var result = await _userManager.DeleteAsync(user);
            if (!result.Succeeded)
            {
                var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                throw new InvalidOperationException($"Failed to delete user: {errors}");
            }

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }
}
