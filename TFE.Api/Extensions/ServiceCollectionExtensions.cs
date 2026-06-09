using Supabase;
using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Interfaces.IServices.Auth;
using TFE.Api.Interfaces.IServices.CollaborativeWall;
using TFE.Api.Interfaces.IServices.Invitations;
using TFE.Api.Interfaces.IServices.Patients;
using TFE.Api.Interfaces.IServices.Sessions;
using TFE.Api.Repositories;
using TFE.Api.Services.Auth;
using TFE.Api.Services.CollaborativeWall;
using TFE.Api.Services.Invitations;
using TFE.Api.Services.Patients;
using TFE.Api.Services.Sessions;

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
        services.AddScoped<IFileStorageService, SupabaseStorageService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IPatientService, PatientService>();
        services.AddScoped<IEnrollmentService, EnrollmentService>();
        services.AddScoped<IWallService, WallService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IInvitationService, InvitationService>();
        services.AddScoped<ISessionService, SessionService>();

        return services;
    }

    /// <summary>
    /// Registers the Supabase client singleton using configuration from the "Supabase" section.
    /// Call this before <see cref="AddApplicationServices"/> so the client is available for injection.
    /// </summary>
    public static IServiceCollection AddSupabaseClient(this IServiceCollection services, IConfiguration configuration)
    {
        var url = configuration["Supabase:Url"]
            ?? throw new InvalidOperationException("Supabase:Url is not configured.");
        var serviceRoleKey = configuration["Supabase:ServiceRoleKey"]
            ?? throw new InvalidOperationException("Supabase:ServiceRoleKey is not configured.");

        services.AddSingleton(_ =>
        {
            var client = new Client(url, serviceRoleKey, new SupabaseOptions
            {
                AutoRefreshToken = false,
                AutoConnectRealtime = false,
            });
            // Blocking initialization is acceptable for a singleton created once at startup.
            client.InitializeAsync().GetAwaiter().GetResult();
            return client;
        });

        return services;
    }
}
