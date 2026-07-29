using System.Text.RegularExpressions;

namespace TFE.Api.Options;

/// <summary>
/// Cross-origin policy for the browser clients, bound from the "Cors" section.
///
/// Named FrontendCorsOptions rather than CorsOptions to avoid colliding with
/// Microsoft.AspNetCore.Cors.Infrastructure.CorsOptions, which Program.cs also has in scope.
///
/// The allow-list has to be configuration-driven because the frontend origin differs per
/// environment (Vite dev server locally, the hosting platform in production) while the API image
/// stays identical. On Azure App Service each entry is overridable as an application setting using
/// the array-index convention: Cors__AllowedOrigins__0, Cors__AllowedOrigins__1, …
/// </summary>
public class FrontendCorsOptions
{
    public const string SectionName = "Cors";

    /// <summary>Name of the registered policy — shared between AddCors and UseCors.</summary>
    public const string PolicyName = "FrontendClients";

    /// <summary>
    /// Exact origins allowed to call the API, scheme included and WITHOUT a trailing slash
    /// (e.g. "https://app.example.com"). An origin is a scheme+host+port triple; anything else
    /// never matches the browser's Origin header.
    /// </summary>
    public string[] AllowedOrigins { get; set; } = [];

    /// <summary>
    /// Optional wildcard patterns, for hosting platforms that mint a fresh URL per deployment
    /// (Vercel preview builds, for instance). A single '*' matches any run of characters other than
    /// '/', so "https://myproject-*.vercel.app" admits every preview of that project.
    ///
    /// Empty by default, and deliberately so: a pattern is materially weaker than an exact origin.
    /// Keep the fixed part specific enough that no third party can register a name matching it — a
    /// pattern such as "https://*.vercel.app" would hand every tenant of the platform a credentialed
    /// cross-origin channel into this API.
    /// </summary>
    public string[] AllowedOriginPatterns { get; set; } = [];

    /// <summary>
    /// Predicate handed to SetIsOriginAllowed: an origin passes when it is listed verbatim or
    /// matches one of the patterns. Host comparison is case-insensitive, as hostnames are.
    /// </summary>
    public bool IsOriginAllowed(string origin) =>
        AllowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase)
        || AllowedOriginPatterns.Any(pattern => MatchesPattern(origin, pattern));

    private static bool MatchesPattern(string origin, string pattern)
    {
        // Escape first, then reopen only the wildcard, so no other regex metacharacter in the
        // pattern is interpreted. '*' spans anything but '/' to keep the match inside the authority.
        var expression = "^" + Regex.Escape(pattern).Replace("\\*", "[^/]*") + "$";
        return Regex.IsMatch(origin, expression, RegexOptions.IgnoreCase);
    }

    /// <summary>
    /// Fails fast on the two misconfigurations that otherwise surface only as an opaque, hard to
    /// trace CORS error in the browser: no origin at all, and a trailing slash (a URL, not an origin).
    /// </summary>
    public void Validate()
    {
        if (AllowedOrigins.Length == 0 && AllowedOriginPatterns.Length == 0)
        {
            throw new InvalidOperationException(
                $"{SectionName}:AllowedOrigins is empty. Every browser call would be rejected as " +
                "cross-origin. Configure at least one origin for this environment.");
        }

        var malformed = AllowedOrigins
            .Concat(AllowedOriginPatterns)
            .Where(origin => origin.EndsWith('/'))
            .ToArray();

        if (malformed.Length > 0)
        {
            throw new InvalidOperationException(
                $"{SectionName}: these entries end with '/' and can never match the browser's Origin " +
                $"header, which carries no path: {string.Join(", ", malformed)}");
        }
    }
}
