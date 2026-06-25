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

    // Strict French system prompt. Produces a direct, unstructured clinical summary: faithful to the
    // notes (no fabrication), length-proportional to the input, and free of predefined section headers.
    private const string SystemPrompt =
        "Tu es un assistant de rédaction clinique pour un psychologue. Ton unique tâche est de rédiger " +
        "une synthèse professionnelle, claire et concise des notes brutes de consultation fournies.\n" +
        "Tu dois respecter STRICTEMENT les consignes suivantes :\n" +
        "1. Reste fidèle aux notes : n'invente AUCUN fait, AUCUN symptôme, AUCUNE émotion et AUCUNE " +
        "étape future non mentionnée.\n" +
        "2. Si la note est ultra-courte, ta synthèse doit l'être aussi. Ne cherche pas à l'étoffer.\n" +
        "3. Restitue le résultat sous forme d'un court paragraphe narratif ou d'une liste à puces " +
        "factuelle en Markdown, sans utiliser de titres de sections prédéfinis.\n" +
        "4. Adopte un ton neutre, clinique et professionnel.";

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
