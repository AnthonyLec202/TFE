using TFE.Api.DTOs.ClinicalTools;

namespace TFE.Api.Interfaces.IServices.ClinicalTools;

public interface ITherapeuticToolService
{
    Task<List<TherapeuticToolResponse>> GetAllAsync(
        string? query,
        string? type,
        string? theme,
        CancellationToken cancellationToken);

    Task<TherapeuticToolResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    Task<TherapeuticToolResponse> CreateAsync(CreateTherapeuticToolRequest request, CancellationToken cancellationToken);

    Task UpdateAsync(Guid id, UpdateTherapeuticToolRequest request, CancellationToken cancellationToken);

    Task DeleteAsync(Guid id, CancellationToken cancellationToken);
}
