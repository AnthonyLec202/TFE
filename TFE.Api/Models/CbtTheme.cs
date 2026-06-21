namespace TFE.Api.Models;

/// <summary>
/// Identifies the clinical theme a therapeutic tool targets. Persisted as an integer; the client
/// mirrors the numeric values.
/// </summary>
public enum CbtTheme
{
    AnxietyManagement,
    EmotionalRegulation,
    SocialSkills,
    CognitiveDistortions,
    Assertiveness
}
