namespace TFE.Api.Models;

/// <summary>
/// Classifies a therapeutic tool by its clinical modality within a CBT (TCC) practice.
/// Persisted as an integer; the client mirrors the numeric values.
/// </summary>
public enum ToolType
{
    BehavioralContract,
    CognitiveRestructuringSheet,
    ExposureProtocol,
    RelaxationExercise,
    PsychoeducationMaterial
}
