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
/// ever sees its own capture format and an annotated transcription back. Swapping providers touches
/// this file alone.
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
        return ExtractRecognition(json);
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
            configuration = new
            {
                lang = _options.Language,
                // Ask for the layout detail the flat label cannot carry. Without this the response
                // says only "these are three lines", never whether the writer broke them on purpose
                // or simply ran out of room — and the client then has no basis for folding a wrapped
                // line back into its sentence. Hyphenated keys force a dictionary here: an
                // anonymous-type member cannot be named "bounding-box".
                export = new
                {
                    jiix = new Dictionary<string, object>
                    {
                        ["text"] = new Dictionary<string, object>
                        {
                            // The array of text-item / list-item / divider entries carrying
                            // `explicit-linebreak`. This is the signal the whole feature turns on.
                            ["structure"] = true,
                            // Word-level detail; its bounding boxes back the per-line geometry.
                            ["words"] = true,
                        },
                        ["bounding-box"] = true,
                    },
                },
            },
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
    /// Pulls the transcription out of a JIIX document and annotates it with the provider's own layout
    /// analysis.
    ///
    /// The root "label" stays authoritative for the text: it is the one property every JIIX document
    /// carries, and splitting it on newlines yields the visual lines the provider segmented. The
    /// "structure" and "words" arrays only annotate those lines. Anything missing, unknown or
    /// self-inconsistent leaves the annotations at their safe defaults — every line an explicit break,
    /// which reproduces the previous one-paragraph-per-line behaviour exactly.
    ///
    /// A missing or non-string "label" is still treated as "nothing legible" rather than an error: the
    /// provider legitimately returns an empty result for a scribble, and a shape change on their side
    /// should degrade to an empty note rather than an exception the clinician cannot act on.
    /// </summary>
    private RecognizeHandwritingResponse ExtractRecognition(string jiixJson)
    {
        try
        {
            using var document = JsonDocument.Parse(jiixJson);
            var root = document.RootElement;

            if (root.ValueKind != JsonValueKind.Object ||
                !root.TryGetProperty("label", out var labelElement) ||
                labelElement.ValueKind != JsonValueKind.String)
            {
                _logger.LogWarning("[Handwriting] JIIX response carried no string 'label' property.");
                return new RecognizeHandwritingResponse();
            }

            var label = labelElement.GetString() ?? string.Empty;

            // Split without dropping anything yet: "structure" addresses lines by index into this very
            // array, so removing a blank line here would shift every later index by one.
            var lines = label
                .Split('\n')
                .Select(line => new RecognizedLine { Text = line.Trim(), IsExplicitBreak = true })
                .ToList();

            ApplyStructure(root, lines);

            // Blank lines carry no text and own no word boxes, so they go before geometry is derived.
            // What they represented is already recorded: the line that follows was annotated as an
            // explicit break.
            var contentLines = lines.Where(line => line.Text.Length > 0).ToList();
            if (contentLines.Count == 0) return new RecognizeHandwritingResponse();

            ApplyGeometry(root, contentLines);

            return new RecognizeHandwritingResponse { Text = label, Lines = contentLines };
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "[Handwriting] Could not parse the JIIX response as JSON.");
            return new RecognizeHandwritingResponse();
        }
    }

    /// <summary>One line's layout annotation, staged before being committed onto the line list.</summary>
    private readonly record struct LineAnnotation(
        RecognizedLineKind Kind,
        string? BulletKind,
        bool IsExplicitBreak);

    /// <summary>
    /// Applies the provider's "structure" analysis onto the lines split out of the label.
    ///
    /// Two readings of the item model are possible and the documentation does not settle which one the
    /// batch engine produces — one item per paragraph spanning several lines, or one item per line.
    /// This handles both: within an item only the first line can open a block, and the item's own
    /// `explicit-linebreak` decides whether that break was deliberate. Under either reading a wrapped
    /// line comes out implicit and a deliberate one comes out explicit.
    ///
    /// Staged then committed: a structure that disagrees with the label — an index out of range, an
    /// item type we do not recognise — must leave every line at its safe default rather than annotate
    /// part of the transcription and let the rest merge by accident.
    /// </summary>
    private void ApplyStructure(JsonElement root, List<RecognizedLine> lines)
    {
        if (!root.TryGetProperty("structure", out var structure) ||
            structure.ValueKind != JsonValueKind.Array)
        {
            _logger.LogInformation(
                "[Handwriting] JIIX response carried no 'structure' array; every line is kept as a " +
                "deliberate break. Check that export.jiix.text.structure is honoured by the endpoint.");
            return;
        }

        var staged = new LineAnnotation?[lines.Count];

        foreach (var item in structure.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object) return;
            if (!item.TryGetProperty("type", out var typeElement) ||
                typeElement.ValueKind != JsonValueKind.String) return;

            var type = typeElement.GetString();

            // A divider is a horizontal rule. It owns line indices but contributes no text to the
            // label, so honouring its span would shift the mapping of every line after it.
            if (type == "divider") continue;

            var kind = type switch
            {
                "text-item" => RecognizedLineKind.Text,
                "list-item" => RecognizedLineKind.ListItem,
                _ => (RecognizedLineKind?)null,
            };
            if (kind is null) return;

            if (!TryGetInt32(item, "first-line", out var firstLine) ||
                !TryGetInt32(item, "last-line", out var lastLine)) return;
            if (firstLine < 0 || lastLine < firstLine || lastLine >= lines.Count) return;

            // Absent means deliberate: only an explicit `false` may license folding a line into its
            // predecessor, because merging text the writer meant to separate is the destructive error.
            var isExplicitBreak =
                !item.TryGetProperty("explicit-linebreak", out var breakElement) ||
                breakElement.ValueKind != JsonValueKind.False;

            var bulletKind = kind == RecognizedLineKind.ListItem ? ReadBulletKind(item) : null;

            for (var index = firstLine; index <= lastLine; index++)
            {
                staged[index] = new LineAnnotation(
                    kind.Value,
                    bulletKind,
                    // Only an item's first line can open a block; the rest wrapped inside it. The very
                    // first line of the document always opens one, whatever the provider reports.
                    index == firstLine && (isExplicitBreak || firstLine == 0));
            }
        }

        for (var index = 0; index < lines.Count; index++)
        {
            if (staged[index] is not { } annotation) continue;
            lines[index].Kind = annotation.Kind;
            lines[index].BulletKind = annotation.BulletKind;
            lines[index].IsExplicitBreak = annotation.IsExplicitBreak;
        }
    }

    /// <summary>Reads a list item's bullet flavour ("bullet", "letter", "number", "check").</summary>
    private static string? ReadBulletKind(JsonElement item)
    {
        if (!item.TryGetProperty("bullet", out var bullet) || bullet.ValueKind != JsonValueKind.Object)
            return null;
        if (!bullet.TryGetProperty("kind", out var kind) || kind.ValueKind != JsonValueKind.String)
            return null;
        return kind.GetString();
    }

    /// <summary>
    /// Derives each line's vertical extent by clustering the word bounding boxes into bands.
    ///
    /// Words arrive in reading order, so a word whose box starts at or below the current band's bottom
    /// opens the next one. The result is checked against the line count before being committed: a
    /// disagreement means the clustering did not reproduce the provider's own segmentation, and an
    /// off-by-one would hand every line its neighbour's geometry. Reporting none is then the honest
    /// outcome — this is a secondary signal, and an approximate one is worse than absent.
    /// </summary>
    private static void ApplyGeometry(JsonElement root, List<RecognizedLine> lines)
    {
        if (!root.TryGetProperty("words", out var words) || words.ValueKind != JsonValueKind.Array) return;

        var bands = new List<(double Top, double Bottom)>();

        foreach (var word in words.EnumerateArray())
        {
            if (word.ValueKind != JsonValueKind.Object) continue;
            if (!word.TryGetProperty("bounding-box", out var box) || box.ValueKind != JsonValueKind.Object)
                continue;
            if (!TryGetDouble(box, "y", out var top) || !TryGetDouble(box, "height", out var height))
                continue;
            // A whitespace "word" carries a degenerate box that would stretch a band for no ink.
            if (height <= 0) continue;

            var bottom = top + height;

            if (bands.Count == 0 || top >= bands[^1].Bottom)
            {
                bands.Add((top, bottom));
                continue;
            }

            var current = bands[^1];
            bands[^1] = (Math.Min(current.Top, top), Math.Max(current.Bottom, bottom));
        }

        if (bands.Count != lines.Count) return;

        for (var index = 0; index < lines.Count; index++)
        {
            lines[index].Top = bands[index].Top;
            lines[index].Bottom = bands[index].Bottom;
        }
    }

    private static bool TryGetInt32(JsonElement element, string propertyName, out int value)
    {
        value = 0;
        return element.TryGetProperty(propertyName, out var property) &&
               property.ValueKind == JsonValueKind.Number &&
               property.TryGetInt32(out value);
    }

    private static bool TryGetDouble(JsonElement element, string propertyName, out double value)
    {
        value = 0;
        return element.TryGetProperty(propertyName, out var property) &&
               property.ValueKind == JsonValueKind.Number &&
               property.TryGetDouble(out value);
    }
}
