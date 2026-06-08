using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace TFE.Api.Validators.CollaborativeWall;

/// <summary>
/// Stateless validator for uploaded attachment files.
/// Enforces size, MIME type, and extension rules before any storage or database operation.
/// </summary>
internal static class AttachmentValidator
{
    private const long MaxFileSizeBytes = 10L * 1024 * 1024; // 10 MB

    private static readonly HashSet<string> AllowedMimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "application/pdf",
        "image/jpeg",
        "image/png",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".jpg", ".jpeg", ".png", ".docx",
    };

    /// <summary>
    /// Validates a single file against size, MIME type, and extension constraints.
    /// Throws <see cref="ValidationException"/> on the first failing constraint.
    /// </summary>
    public static void Validate(IFormFile file)
    {
        if (file.Length == 0)
            throw new ValidationException($"File '{file.FileName}' is empty.");

        if (file.Length > MaxFileSizeBytes)
            throw new ValidationException(
                $"File '{file.FileName}' exceeds the maximum allowed size of 10 MB " +
                $"(received {file.Length / (1024.0 * 1024):F1} MB).");

        if (!AllowedMimeTypes.Contains(file.ContentType))
            throw new ValidationException(
                $"File '{file.FileName}' has a disallowed content type '{file.ContentType}'. " +
                "Accepted types: PDF, JPEG, PNG, DOCX.");

        var extension = Path.GetExtension(file.FileName);
        if (string.IsNullOrEmpty(extension) || !AllowedExtensions.Contains(extension))
            throw new ValidationException(
                $"File '{file.FileName}' has a disallowed extension '{extension}'. " +
                "Accepted extensions: .pdf, .jpg, .jpeg, .png, .docx.");
    }

    /// <summary>
    /// Validates all files in the collection. Fails on the first invalid file.
    /// A null or empty collection is valid (attachment-free post).
    /// </summary>
    public static void ValidateAll(IEnumerable<IFormFile>? files)
    {
        if (files is null) return;
        foreach (var file in files)
            Validate(file);
    }
}
