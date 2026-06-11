namespace TFE.Api.Exceptions;

/// <summary>
/// Thrown by a repository when a write violates a unique / primary-key constraint
/// (SQLSTATE 23505). It lets the service layer treat a duplicate insert idempotently
/// without depending on the underlying database provider's exception types.
/// </summary>
public class DuplicateEntityException : Exception
{
    public DuplicateEntityException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
