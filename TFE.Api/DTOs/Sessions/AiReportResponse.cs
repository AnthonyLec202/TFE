namespace TFE.Api.DTOs.Sessions;

/// <summary>The freshly generated AI clinical report (Markdown), returned by the generation endpoint.</summary>
public class AiReportResponse
{
    public string Report { get; set; } = string.Empty;
}
