using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Interfaces.IServices;
using TFE.Api.Repositories;
using TFE.Api.Services;

namespace TFE.Api.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        // ── Repositories ──────────────────────────────────────────────────────
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IPatientRepository, PatientRepository>();
        services.AddScoped<IEnrollmentTokenRepository, EnrollmentTokenRepository>();
        services.AddScoped<ICareTeamRepository, CareTeamRepository>();

        // ── Services ──────────────────────────────────────────────────────────
        services.AddScoped<IEmailService, EmailService>();
        services.AddScoped<IStorageService, DummyStorageService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IPatientService, PatientService>();
        services.AddScoped<IEnrollmentService, EnrollmentService>();
        services.AddScoped<IWallService, WallService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IInvitationService, InvitationService>();

        return services;
    }
}
