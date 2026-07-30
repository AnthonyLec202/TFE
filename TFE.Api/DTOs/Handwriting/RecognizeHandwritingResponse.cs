namespace TFE.Api.DTOs.Handwriting;

/// <summary>
/// The transcription of a submitted set of strokes.
/// </summary>
public class RecognizeHandwritingResponse
{
    /// <summary>
    /// Recognized plain text. Empty when the strokes carried no legible content — a legitimate
    /// outcome (a scribble, a crossed-out word), not an error.
    /// </summary>
    public string Text { get; set; } = string.Empty;
}
