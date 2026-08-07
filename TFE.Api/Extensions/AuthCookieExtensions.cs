namespace TFE.Api.Extensions;

/// <summary>
/// Centralises the issuance and clearing of the JWT session cookie (F-02 XSS mitigation).
/// The token is delivered in an HttpOnly cookie so JavaScript can never read it; the API authenticates
/// every request (and the SignalR handshake) from this cookie instead of an Authorization header.
/// </summary>
public static class AuthCookieExtensions
{
    public const string AuthCookieName = "np_auth_token";

    /// <summary>
    /// Writes the JWT into the response as a hardened cookie whose lifetime matches the token's own
    /// expiry, so the browser drops it at the same instant the token stops validating.
    /// </summary>
    public static void AppendAuthCookie(this HttpResponse response, string token, DateTimeOffset expiresAt)
        => response.Cookies.Append(AuthCookieName, token, BuildCookieOptions(expiresAt));

    /// <summary>
    /// Emits an already-expired cookie carrying the same attributes, instructing the browser to delete
    /// the session cookie. Used by the logout endpoint.
    /// </summary>
    public static void ClearAuthCookie(this HttpResponse response)
        => response.Cookies.Delete(AuthCookieName, BuildCookieOptions(DateTimeOffset.UnixEpoch));

    private static CookieOptions BuildCookieOptions(DateTimeOffset expiresAt) => new()
    {
        HttpOnly = true,                  // unreadable by document.cookie / JS — the core XSS mitigation
        Secure = true,                    // HTTPS only (browsers still accept it on http://localhost)
        // Lax, not None. The browser reaches this API through the frontend's own origin — the
        // deployment proxies /api, /hubs and /health to the App Service — so the cookie is
        // first-party and never travels cross-site. SameSite=None was required only while the SPA
        // called *.azurewebsites.net directly, and it is precisely what phones refuse: WebKit's ITP,
        // Firefox's Total Cookie Protection and Chrome's third-party phase-out all block cross-site
        // cookies by default, which made login impossible on every mobile browser while working on
        // desktop. Lax additionally restores the CSRF protection that None gives up.
        SameSite = SameSiteMode.Lax,
        // No Domain attribute, deliberately: the cookie stays host-only and is scoped to the exact
        // host that issued it. A Domain of ".juliette-marechal.be" would broadcast this session JWT
        // to every subdomain — including the showcase site hosted by a third party.
        Path = "/",
        IsEssential = true,               // exempt from the cookie consent policy (strictly necessary)
        Expires = expiresAt,
    };
}
