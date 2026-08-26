using System.Text.Json;
using System.Text.Json.Serialization;

namespace TFE.Api.DTOs.Handwriting;

/// <summary>
/// How a recognized line participates in the note's layout.
/// </summary>
[JsonConverter(typeof(RecognizedLineKindConverter))]
public enum RecognizedLineKind
{
    /// <summary>Ordinary prose line.</summary>
    Text = 0,

    /// <summary>Line belonging to a list item (bulleted, numbered, lettered or checked).</summary>
    ListItem = 1,
}

/// <summary>
/// Writes <see cref="RecognizedLineKind"/> as a camelCase string ("text", "listItem") instead of the
/// ordinal ASP.NET emits by default.
///
/// Scoped to this enum by attribute rather than registered globally: turning on string enums for the
/// whole API would silently rewrite the wire contract of every existing endpoint.
/// </summary>
public sealed class RecognizedLineKindConverter : JsonStringEnumConverter<RecognizedLineKind>
{
    public RecognizedLineKindConverter() : base(JsonNamingPolicy.CamelCase) { }
}

/// <summary>
/// One visual line of handwriting as the recognizer segmented it, carrying the layout signals the
/// client needs to decide whether the line continues the previous one or opens a new block.
///
/// The line texts themselves come from the JIIX root label, which is authoritative; everything else
/// here is an annotation layered on top of it. A line the provider gave us no layout information for
/// is reported as an explicit break, which reproduces the pre-existing one-paragraph-per-line
/// behaviour rather than silently merging content the writer meant to keep apart.
/// </summary>
public class RecognizedLine
{
    /// <summary>Recognized text of this visual line, trimmed.</summary>
    public string Text { get; set; } = string.Empty;

    /// <summary>
    /// True when the writer deliberately opened a new line. MyScript reports an explicit break when
    /// the writer returned to the next line although the word still fitted at the end of the previous
    /// one; a line that only wrapped because the writer ran out of horizontal room is implicit, and
    /// the client is free to fold it back into the preceding line.
    ///
    /// The first line of a transcription is always explicit — it opens a block by definition.
    /// </summary>
    public bool IsExplicitBreak { get; set; }

    public RecognizedLineKind Kind { get; set; } = RecognizedLineKind.Text;

    /// <summary>
    /// Bullet flavour of a <see cref="RecognizedLineKind.ListItem"/> line, forwarded verbatim from the
    /// provider ("bullet", "letter", "number", "check"). Null on prose lines.
    /// </summary>
    public string? BulletKind { get; set; }

    /// <summary>
    /// Top edge of the line's ink in the provider's coordinate space (millimetres). Null when the
    /// per-line geometry could not be established — it is a secondary signal, and an approximate one
    /// would be worse than none.
    /// </summary>
    public double? Top { get; set; }

    /// <summary>Bottom edge of the line's ink. Null under the same conditions as <see cref="Top"/>.</summary>
    public double? Bottom { get; set; }
}

/// <summary>
/// The transcription of a submitted set of strokes.
/// </summary>
public class RecognizeHandwritingResponse
{
    /// <summary>
    /// Recognized plain text, lines separated by newlines. Empty when the strokes carried no legible
    /// content — a legitimate outcome (a scribble, a crossed-out word), not an error.
    ///
    /// Kept alongside <see cref="Lines"/> as the flat rendering of the same result: it is what a
    /// client that does not care about layout should read, and what an older client still reads.
    /// </summary>
    public string Text { get; set; } = string.Empty;

    /// <summary>
    /// The same transcription split into visual lines and annotated with layout. Empty only when
    /// <see cref="Text"/> is empty.
    /// </summary>
    public List<RecognizedLine> Lines { get; set; } = [];
}
