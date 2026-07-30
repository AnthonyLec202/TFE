namespace TFE.Api.Options;

/// <summary>
/// Credentials and settings for the MyScript handwriting recognition service, bound from the
/// "Handwriting" section.
///
/// ApplicationKey and HmacKey are secrets and are deliberately left empty in appsettings.json —
/// supply them per environment (Azure application settings: Handwriting__ApplicationKey,
/// Handwriting__HmacKey). They must never reach the browser bundle: the HMAC key exists to prove a
/// request originates from this server, so publishing it would defeat its only purpose.
/// </summary>
public class HandwritingOptions
{
    public const string SectionName = "Handwriting";

    /// <summary>MyScript iink REST endpoint for one-shot (non-interactive) recognition.</summary>
    public string BatchUrl { get; set; } = "https://cloud.myscript.com/api/v4.0/iink/batch";

    /// <summary>MyScript application key. Empty disables the feature (the endpoint answers 503).</summary>
    public string ApplicationKey { get; set; } = string.Empty;

    /// <summary>MyScript HMAC signing key, paired with the application key.</summary>
    public string HmacKey { get; set; } = string.Empty;

    /// <summary>Recognition language tag passed to the provider.</summary>
    public string Language { get; set; } = "fr_FR";

    /// <summary>
    /// Upper bound on the number of points accepted in one request. A generation is billed per call,
    /// and an unbounded payload is both a cost and a memory risk; a full page of handwriting is on
    /// the order of a few thousand points, so this leaves ample headroom.
    /// </summary>
    public int MaxPoints { get; set; } = 60000;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(ApplicationKey) && !string.IsNullOrWhiteSpace(HmacKey);
}
