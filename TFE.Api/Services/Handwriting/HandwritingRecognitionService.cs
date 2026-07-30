using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using TFE.Api.DTOs.Handwriting;
using TFE.Api.Interfaces.IServices.Handwriting;
using TFE.Api.Options;

namespace TFE.Api.Services.Handwriting;

/// <summary>
/// MyScript-backed implementation of <see cref="IHandwritingRecognitionService"/>.
///
/// Owns the whole provider contract — wire format, HMAC signature, JIIX parsing — so the client only
/// ever sees its own capture format and a plain string back. Swapping providers touches this file
/// alone.
/// </summary>
public class HandwritingRecognitionService : IHandwritingRecognitionService
{
    /// <summary>Named client registered in ServiceCollectionExtensions with the provider timeout.</summary>
    public const string HttpClientName = "MyScriptClient";

    private static readonly JsonSerializerOptions PayloadSerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly HandwritingOptions _options;
    private readonly ILogger<HandwritingRecognitionService> _logger;

    public HandwritingRecognitionService(
        IHttpClientFactory httpClientFactory,
        HandwritingOptions options,
        ILogger<HandwritingRecognitionService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options;
        _logger = logger;
    }

    public async Task<RecognizeHandwritingResponse> RecognizeAsync(
        RecognizeHandwritingRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!_options.IsConfigured)
        {
            throw new InvalidOperationException(
                "Handwriting recognition is not configured: set Handwriting:ApplicationKey and Handwriting:HmacKey.");
        }

        // Drop empty strokes before counting and before sending: a zero-point stroke is meaningless
        // to the recognizer and a pen-down/pen-up with no movement produces one.
        var strokes = request.Strokes.Where(stroke => stroke.Count > 0).ToList();
        if (strokes.Count == 0)
            return new RecognizeHandwritingResponse();

        var pointCount = strokes.Sum(stroke => stroke.Count);
        if (pointCount > _options.MaxPoints)
        {
            throw new ArgumentOutOfRangeException(
                nameof(request),
                $"Stroke payload holds {pointCount} points, above the {_options.MaxPoints} limit.");
        }

        var payload = JsonSerializer.Serialize(BuildProviderPayload(request, strokes), PayloadSerializerOptions);

        using var message = new HttpRequestMessage(HttpMethod.Post, _options.BatchUrl)
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json"),
        };
        message.Headers.Add("Accept", "application/vnd.myscript.jiix");
        message.Headers.Add("applicationKey", _options.ApplicationKey);
        message.Headers.Add("hmac", ComputeHmac(payload, _options.ApplicationKey, _options.HmacKey));

        var httpClient = _httpClientFactory.CreateClient(HttpClientName);
        using var response = await httpClient.SendAsync(message, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            // The body can echo provider-side detail; log it for diagnosis but never surface it to
            // the client, where it could disclose account or key information.
            _logger.LogError(
                "[Handwriting] MyScript rejected the request with {StatusCode}. Body: {Body}",
                (int)response.StatusCode, body);

            throw new HttpRequestException(
                $"The handwriting recognition provider answered {(int)response.StatusCode}.",
                null,
                response.StatusCode);
        }

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        return new RecognizeHandwritingResponse { Text = ExtractLabel(json) };
    }

    /// <summary>
    /// Maps the client's capture format to MyScript's, transposing each stroke's points into the
    /// parallel x/y/t arrays the provider expects.
    /// </summary>
    private object BuildProviderPayload(
        RecognizeHandwritingRequest request,
        List<List<StrokePointRequest>> strokes) => new
        {
            // The real capture dimensions, forwarded verbatim. A fixed constant here would place
            // strokes outside the declared writing area as soon as the canvas grew past it, silently
            // degrading recognition on longer notes.
            width = request.Width,
            height = request.Height,
            contentType = "Text",
            configuration = new { lang = _options.Language },
            strokeGroups = new[]
            {
                new
                {
                    strokes = strokes.Select(stroke => new
                    {
                        x = stroke.Select(point => point.X).ToArray(),
                        y = stroke.Select(point => point.Y).ToArray(),
                        t = stroke.Select(point => point.T).ToArray(),
                    }).ToArray(),
                },
            },
        };

    /// <summary>
    /// MyScript authenticates a request with HMAC-SHA512 over the exact body, keyed by the
    /// concatenation of the application key and the HMAC key, hex-encoded lowercase.
    /// </summary>
    private static string ComputeHmac(string payload, string applicationKey, string hmacKey)
    {
        using var hmac = new HMACSHA512(Encoding.UTF8.GetBytes(applicationKey + hmacKey));
        var signature = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
        return Convert.ToHexStringLower(signature);
    }

    /// <summary>
    /// Pulls the transcription out of a JIIX document.
    ///
    /// A missing or non-string "label" is treated as "nothing legible" rather than an error: the
    /// provider legitimately returns an empty result for a scribble, and a shape change on their side
    /// should degrade to an empty note rather than an exception the clinician cannot act on.
    /// </summary>
    private string ExtractLabel(string jiixJson)
    {
        try
        {
            using var document = JsonDocument.Parse(jiixJson);
            if (document.RootElement.TryGetProperty("label", out var label) &&
                label.ValueKind == JsonValueKind.String)
            {
                return label.GetString() ?? string.Empty;
            }

            _logger.LogWarning("[Handwriting] JIIX response carried no string 'label' property.");
            return string.Empty;
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "[Handwriting] Could not parse the JIIX response as JSON.");
            return string.Empty;
        }
    }
}
