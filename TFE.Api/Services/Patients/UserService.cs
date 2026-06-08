using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TFE.Api.Data;
using TFE.Api.Interfaces.IServices.CollaborativeWall;
using TFE.Api.Interfaces.IServices.Patients;
using TFE.Api.Models;

namespace TFE.Api.Services.Patients;

public class UserService : IUserService
{
    private const string DeletedContent = "Compte supprimé - Contenu invisible";

    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IStorageService _storageService;

    public UserService(
        ApplicationDbContext context,
        UserManager<ApplicationUser> userManager,
        IStorageService storageService)
    {
        _context = context;
        _userManager = userManager;
        _storageService = storageService;
    }

    public async Task DeleteUserAsync(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId)
            ?? throw new KeyNotFoundException($"User {userId} not found.");

        await using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            var posts = await _context.Posts
                .Include(p => p.Attachments)
                .Where(p => p.CreatedById == userId)
                .ToListAsync();

            var comments = await _context.Comments
                .Include(c => c.Attachments)
                .Where(c => c.CreatedById == userId)
                .ToListAsync();

            foreach (var post in posts)
            {
                foreach (var att in post.Attachments)
                {
                    await _storageService.DeleteFileAsync(att.FileUrl);
                    _context.Attachments.Remove(att);
                }
                post.Content = DeletedContent;
            }

            foreach (var comment in comments)
            {
                foreach (var att in comment.Attachments)
                {
                    await _storageService.DeleteFileAsync(att.FileUrl);
                    _context.Attachments.Remove(att);
                }
                comment.Content = DeletedContent;
            }

            await _context.SaveChangesAsync();

            var result = await _userManager.DeleteAsync(user);
            if (!result.Succeeded)
            {
                var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                throw new InvalidOperationException($"Failed to delete user: {errors}");
            }

            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }
}
