using TFE.Api.DTOs.ClinicalTools;
using TFE.Api.Interfaces;
using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Interfaces.IServices.ClinicalTools;
using TFE.Api.Models;

namespace TFE.Api.Services.ClinicalTools;

public class TherapeuticToolService : ITherapeuticToolService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ITherapeuticToolRepository _toolRepository;

    public TherapeuticToolService(IUnitOfWork unitOfWork, ITherapeuticToolRepository toolRepository)
    {
        _unitOfWork = unitOfWork;
        _toolRepository = toolRepository;
    }

    public async Task<List<TherapeuticToolResponse>> GetAllAsync(
        string? query,
        string? type,
        string? theme,
        CancellationToken cancellationToken)
    {
        var tools = await _toolRepository.GetAllAsync(query, type, theme, cancellationToken);
        return tools.Select(MapToResponse).ToList();
    }

    public async Task<TherapeuticToolResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var tool = await _toolRepository.GetByIdAsync(id, cancellationToken);
        return tool is null ? null : MapToResponse(tool);
    }

    public async Task<TherapeuticToolResponse> CreateAsync(CreateTherapeuticToolRequest request, CancellationToken cancellationToken)
    {
        // A client-supplied id is honoured (offline-first stable identity); otherwise the server mints one.
        var tool = new TherapeuticTool
        {
            Id = request.Id ?? Guid.NewGuid(),
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            Type = request.Type.Trim(),
            Theme = request.Theme.Trim(),
            DownGradingStrategy = request.DownGradingStrategy.Trim(),
            UpGradingStrategy = request.UpGradingStrategy.Trim(),
        };

        await _toolRepository.AddAsync(tool, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return MapToResponse(tool);
    }

    public async Task UpdateAsync(Guid id, UpdateTherapeuticToolRequest request, CancellationToken cancellationToken)
    {
        var tool = await _toolRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException($"Therapeutic tool {id} not found.");

        tool.Title = request.Title.Trim();
        tool.Description = request.Description.Trim();
        tool.Type = request.Type.Trim();
        tool.Theme = request.Theme.Trim();
        tool.DownGradingStrategy = request.DownGradingStrategy.Trim();
        tool.UpGradingStrategy = request.UpGradingStrategy.Trim();

        _toolRepository.Update(tool);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var tool = await _toolRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException($"Therapeutic tool {id} not found.");

        _toolRepository.Remove(tool);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private static TherapeuticToolResponse MapToResponse(TherapeuticTool tool) => new()
    {
        Id = tool.Id,
        Title = tool.Title,
        Description = tool.Description,
        Type = tool.Type,
        Theme = tool.Theme,
        DownGradingStrategy = tool.DownGradingStrategy,
        UpGradingStrategy = tool.UpGradingStrategy,
    };
}
