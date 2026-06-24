namespace TFE.Api.Exceptions;

/// <summary>
/// Thrown when a write operation is attempted against an archived patient's resources (e.g. the
/// collaborative wall). Archived dossiers are strictly read-only; the controller maps this to a
/// 403 Forbidden carrying the message so the client can explain why the action was blocked.
/// </summary>
public class ArchivedPatientException : Exception
{
    public ArchivedPatientException(string message) : base(message)
    {
    }
}
