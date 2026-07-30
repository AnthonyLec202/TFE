using System.ComponentModel.DataAnnotations;

namespace TFE.Api.DTOs.Handwriting;

/// <summary>
/// A single sampled pointer position within a stroke, in canvas pixel coordinates.
/// </summary>
public class StrokePointRequest
{
    public double X { get; set; }
    public double Y { get; set; }

    /// <summary>
    /// Milliseconds since the page's time origin. The recognizer uses the temporal spacing between
    /// points (writing speed, pen lifts) as a recognition signal, so it is captured rather than
    /// discarded.
    /// </summary>
    public double T { get; set; }
}

/// <summary>
/// Handwriting captured on the client, submitted for recognition.
///
/// The payload is the client's own capture format — an array of strokes, each an array of sampled
/// points. Mapping it to the recognition provider's wire format is the service layer's job, so the
/// provider stays swappable without touching the API contract or the frontend.
/// </summary>
public class RecognizeHandwritingRequest
{
    /// <summary>Strokes in capture order; each is the ordered list of points of one pen-down/pen-up.</summary>
    [Required]
    [MinLength(1, ErrorMessage = "At least one stroke is required.")]
    public List<List<StrokePointRequest>> Strokes { get; set; } = [];

    /// <summary>
    /// Width in pixels of the surface the strokes were captured on. Forwarded to the recognizer as
    /// the writing-area dimension: coordinates falling outside the declared area degrade recognition,
    /// so this must be the real canvas size, not a fixed constant.
    /// </summary>
    [Range(1, 20000)]
    public int Width { get; set; }

    /// <summary>Height in pixels of the capture surface. The canvas grows as the clinician writes,
    /// so this is whatever it had reached at submission time.</summary>
    [Range(1, 100000)]
    public int Height { get; set; }
}
