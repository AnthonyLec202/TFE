using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using TFE.Api.Interfaces.IServices.Ai;

namespace TFE.Api.Services.Ai;

/// <summary>
/// Semantic Kernel implementation of <see cref="IAiReportService"/>. Drives the locally-hosted Ollama
/// chat model registered in the kernel to turn raw session notes into a structured clinical report.
/// </summary>
public class AiReportService : IAiReportService
{
    private readonly Kernel _kernel;

    // Strict French system prompt. The note arrives as HTML: <strong>/<mark> spans mark elements the
    // clinician flagged as critical, which the model must prioritize. Output is plain Markdown, faithful
    // to the note.
    private const string SystemPrompt =
        "Tu es un assistant clinique. Les notes fournies sont au format HTML. Les éléments entourés par " +
        "les balises <strong> (gras) ou <mark> (surligné) ont été explicitement sélectionnés par le " +
        "psychologue comme des alertes cliniques majeures ou des éléments cardinaux. Tu dois accorder " +
        "une priorité absolue à ces éléments et les placer au centre de ta synthèse. N'invente aucun " +
        "symptôme. Renvoie le rapport final en Markdown pur (sans balises HTML).";

    public AiReportService(Kernel kernel)
    {
        _kernel = kernel;
    }

    public async Task<string> GenerateReportAsync(string sessionNotes, CancellationToken cancellationToken = default)
    {
        var chatCompletionService = _kernel.GetRequiredService<IChatCompletionService>();

        var chatHistory = new ChatHistory();
        chatHistory.AddSystemMessage(SystemPrompt);
        chatHistory.AddUserMessage(sessionNotes);

        var result = await chatCompletionService.GetChatMessageContentAsync(
            chatHistory,
            kernel: _kernel,
            cancellationToken: cancellationToken);

        return result.Content ?? string.Empty;
    }
}
