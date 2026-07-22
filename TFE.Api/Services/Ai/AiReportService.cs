using System.Text.RegularExpressions;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.Ollama;
using TFE.Api.Interfaces.IServices.Ai;
using TFE.Api.Options;

namespace TFE.Api.Services.Ai;

/// <summary>
/// Semantic Kernel implementation of <see cref="IAiReportService"/>. Drives the locally-hosted Ollama
/// chat model (qwen2.5) to turn raw session notes into a structured French clinical report.
/// </summary>
public partial class AiReportService : IAiReportService
{
    private readonly Kernel _kernel;
    private readonly AiOptions _aiOptions;
    private readonly ILogger<AiReportService> _logger;

    /// <summary>
    /// Standardized message returned when the input notes carry no clinically exploitable content.
    /// Exposed as a constant so callers/tests can recognize the "empty" outcome without string-matching
    /// a magic literal. Kept identical to the sentinel the model is instructed to emit, so the guarded
    /// (short-circuit) path and the model path produce the same result.
    /// </summary>
    public const string EmptyNotesMessage = "_Aucun contenu clinique n'a été fourni._";

    // Strict French system prompt for the Qwen (qwen2.5) neuropsychology writing assistant.
    // Notes arrive as HTML/Markdown; <strong>/<b>/**…** mark bold and <mark> marks highlight — the model
    // prioritizes and preserves these. Empty input yields the EmptyNotesMessage sentinel, never
    // boilerplate. Output is Markdown, with <mark> as the only permitted HTML tag.
    private const string SystemPrompt = """
        # RÔLE
        Tu es un assistant expert en rédaction neuropsychologique, spécialisé dans la
        pédiatrie. Ta mission est de convertir les notes de travail brutes d'un
        neuropsychologue en sections de rapport psychologique structurées et
        professionnelles. Tu n'es PAS un clinicien : tu ne poses aucun diagnostic et ne
        formules aucune interprétation qui ne soit pas déjà présente dans les notes.

        # TON & STYLE
        - Rédige dans un français médical et psychologique professionnel, objectif et
          cliniquement rigoureux.
        - Emploie un vocabulaire neuropsychologique précis et une syntaxe soignée.
        - Adopte un registre descriptif et neutre. Évite le jugement de valeur, l'emphase
          affective et toute formulation non étayée par les notes.
        - Utilise la troisième personne et le temps approprié au compte rendu clinique.

        # RÈGLE ABSOLUE DE NON-HALLUCINATION (GARDE-FOU CRITIQUE)
        - Limite-toi STRICTEMENT aux faits, observations, mesures et éléments présents
          dans les notes fournies.
        - N'invente JAMAIS de symptôme, de score, d'antécédent, de diagnostic, de
          recommandation ou de détail non explicitement mentionné.
        - N'extrapole pas, ne déduis pas, n'ajoute aucune généralité clinique « type ».
        - Si une information est ambiguë ou incomplète, reste fidèle à ce qui est écrit
          sans combler les vides.

        # GESTION DES ENTRÉES VIDES (GARDE-FOU CRITIQUE)
        - Si la note fournie est vide, ne contient que des espaces, des balises sans
          texte, ou aucune information cliniquement exploitable, tu DOIS répondre
          EXACTEMENT par la chaîne suivante, sans rien ajouter :

          _Aucun contenu clinique n'a été fourni._

        - Dans ce cas, n'écris AUCUN paragraphe d'évaluation, AUCUNE formule générique,
          AUCUN rapport « par défaut ». L'absence de contenu n'autorise jamais une
          production rédactionnelle.

        # RESTRUCTURATION & REFORMULATION
        - Transforme les notes télégraphiques, listes à puces et mots-clés en phrases
          françaises complètes, fluides et bien construites.
        - Reformule pour la clarté et le professionnalisme, mais PRÉSERVE
          scrupuleusement le sens original et l'exactitude clinique de chaque élément.
        - Ne fusionne pas des observations distinctes au point d'en altérer le sens ;
          ne supprime aucun fait.
        - Organise le texte de façon cohérente (regroupement logique des observations)
          sans introduire de sections ou d'en-têtes non justifiés par le contenu.

        # CONSERVATION DE L'EMPHASE VISUELLE (OBLIGATOIRE)
        Les notes peuvent contenir des marques d'emphase que le clinicien a posées
        délibérément pour signaler des éléments cardinaux ou des alertes majeures :
        - gras Markdown : **texte**
        - gras HTML : <b>texte</b> ou <strong>texte</strong>
        - surlignage HTML : <mark>texte</mark>

        Tu dois IMPÉRATIVEMENT :
        1. Accorder une priorité clinique à ces éléments dans la synthèse.
        2. Conserver l'emphase sur la ou les phrases correspondantes du rapport généré,
           avec un formatage identique :
           - le gras (**, <b>, <strong>) est restitué en gras Markdown **texte** ;
           - le surlignage <mark>texte</mark> est restitué à l'identique en
             <mark>texte</mark>.
        3. Ne jamais ajouter d'emphase là où il n'y en avait pas, ni en retirer là où
           il y en avait.

        # FORMAT DE SORTIE
        - Réponds en Markdown propre.
        - N'émets aucune autre balise HTML que <mark> (réservée au surlignage à
          préserver). Convertis toute autre balise de gras en **...**.
        - Ne produis aucun préambule, commentaire méta, note d'explication ni mention de
          ces instructions. Renvoie uniquement le texte du rapport.

        # EXEMPLES

        ## Exemple 1 — reformulation fidèle avec emphase
        Entrée :
            - attention labile, distractibilité +++
            - **difficultés de mémoire de travail** notées lors des empans
            - <mark>fatigabilité importante en fin de séance</mark>

        Sortie :
            L'attention de l'enfant apparaît labile, avec une distractibilité marquée
            au cours de l'évaluation. Des **difficultés de mémoire de travail** ont été
            observées lors des épreuves d'empans. <mark>Une fatigabilité importante a
            été relevée en fin de séance.</mark>

        ## Exemple 2 — entrée vide
        Entrée :
            (aucun texte)

        Sortie :
            _Aucun contenu clinique n'a été fourni._

        ## Exemple 3 — pas d'ajout d'information
        Entrée :
            - langage oral fluide

        Sortie :
            Le langage oral se présente de manière fluide.
        """;

    public AiReportService(Kernel kernel, AiOptions aiOptions, ILogger<AiReportService> logger)
    {
        _kernel = kernel;
        _aiOptions = aiOptions;
        _logger = logger;
    }

    public async Task<string> GenerateReportAsync(string sessionNotes, CancellationToken cancellationToken = default)
    {
        // Defense-in-depth empty-input guard: even with the prompt instruction, a 7B model can
        // hallucinate a boilerplate report from a blank note. Short-circuit before spending a model
        // call when the note carries no visible text once HTML tags/entities are stripped.
        if (!HasExploitableContent(sessionNotes))
            return EmptyNotesMessage;

        var chatCompletionService = _kernel.GetRequiredService<IChatCompletionService>();

        var chatHistory = new ChatHistory();
        chatHistory.AddSystemMessage(SystemPrompt);
        chatHistory.AddUserMessage(sessionNotes);

        // Low temperature keeps the model faithful to the source notes rather than creative.
        var executionSettings = new OllamaPromptExecutionSettings
        {
            Temperature = _aiOptions.Temperature,
        };

        try
        {
            var result = await chatCompletionService.GetChatMessageContentAsync(
                chatHistory,
                executionSettings,
                kernel: _kernel,
                cancellationToken: cancellationToken);

            return result.Content ?? string.Empty;
        }
        catch (OperationCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            // The caller did not cancel, so this cancellation is the underlying HttpClient hitting its
            // timeout (surfaced as TaskCanceledException, a subclass of OperationCanceledException).
            // Log it distinctly from a genuine caller-initiated cancellation and rethrow as a timeout.
            _logger.LogError(
                ex,
                "[AiReport] Ollama generation timed out (model '{ModelId}'). The request exceeded the " +
                "configured HttpClient timeout before the model responded.",
                _aiOptions.ModelId);

            throw new TimeoutException(
                "AI report generation timed out while waiting for the Ollama model to respond.", ex);
        }
    }

    /// <summary>
    /// Returns true when the note contains at least one non-whitespace character after HTML tags and
    /// entities are removed. Notes arrive as HTML, so a note of only empty markup (e.g. "&lt;p&gt;&lt;br&gt;&lt;/p&gt;")
    /// or non-breaking spaces must be treated as empty.
    /// </summary>
    private static bool HasExploitableContent(string? notes)
    {
        if (string.IsNullOrWhiteSpace(notes))
            return false;

        var withoutTags = HtmlTagRegex().Replace(notes, string.Empty);
        // Collapse the non-breaking-space entity to a space so a note of only "&nbsp;" reads as empty.
        var withoutNbsp = withoutTags.Replace("&nbsp;", " ", StringComparison.OrdinalIgnoreCase);

        return !string.IsNullOrWhiteSpace(withoutNbsp);
    }

    [GeneratedRegex("<[^>]+>")]
    private static partial Regex HtmlTagRegex();
}
