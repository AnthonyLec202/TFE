namespace TFE.Api.DTOs.Sessions;

public class SessionSyncBatchRequest
{
    public List<SyncSessionRequest> Sessions { get; set; } = new();
    public List<SyncNoteRequest> Notes { get; set; } = new();
}
