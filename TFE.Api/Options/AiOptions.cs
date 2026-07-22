namespace TFE.Api.Options;

/// <summary>
/// Configuration for the local Ollama-backed AI report generation, bound from the "Ai" section of
/// appsettings.json. Defaults target a local Ollama instance running the llama3.2 model.
/// </summary>
public class AiOptions
{
    public const string SectionName = "Ai";

    /// <summary>Base URL of the Ollama server exposing the OpenAI-compatible chat API.</summary>
    public string BaseUrl { get; set; } = "http://localhost:11434";

    /// <summary>Identifier of the Ollama model to invoke (e.g. "llama3.2").</summary>
    public string ModelId { get; set; } = "llama3.2";

    /// <summary>
    /// Sampling temperature for report generation. Kept low so the model stays faithful to the
    /// source notes (non-hallucination guardrail) rather than producing creative, invented content.
    /// </summary>
    public float Temperature { get; set; } = 0.15f;
}
