namespace TFE.Api.Interfaces.IServices.Ai;

/// <summary>
/// Generates a structured clinical report from raw session notes using the configured LLM
/// (Semantic Kernel + Ollama).
/// </summary>
public interface IAiReportService
{
    /// <summary>
    /// Produces a structured, Markdown-formatted clinical report from the raw session notes.
    /// </summary>
    /// <param name="sessionNotes">The decrypted, clinician-authored note content for the session.</param>
    /// <param name="cancellationToken">Token to cancel the generation request.</param>
    /// <returns>The generated report as Markdown.</returns>
    Task<string> GenerateReportAsync(string sessionNotes, CancellationToken cancellationToken = default);
}
