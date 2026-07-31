using Supabase;
using TFE.Api.Interfaces;
using TFE.Api.Interfaces.IRepositories;
using TFE.Api.Interfaces.IServices.Auth;
using TFE.Api.Interfaces.IServices.ClinicalTools;
using TFE.Api.Interfaces.IServices.CollaborativeWall;
using TFE.Api.Interfaces.IServices.Encryption;
using TFE.Api.Interfaces.IServices.Handwriting;
using TFE.Api.Interfaces.IServices.Invitations;
using TFE.Api.Interfaces.IServices.Notifications;
using TFE.Api.Interfaces.IServices.Patients;
using TFE.Api.Interfaces.IServices.Sessions;
using TFE.Api.Options;
using TFE.Api.Repositories;
using TFE.Api.Services.Auth;
using TFE.Api.Services.ClinicalTools;
using TFE.Api.Services.CollaborativeWall;
using TFE.Api.Services.Encryption;
using TFE.Api.Services.Handwriting;
using TFE.Api.Services.Invitations;
using TFE.Api.Services.Notifications;
using TFE.Api.Services.Patients;
using TFE.Api.Services.Sessions;

namespace TFE.Api.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        // ── Encryption ────────────────────────────────────────────────────────
        // Singleton: EF Core caches the model (and EncryptedStringConverter) for the application
        // lifetime. The converter captures this service in a closure during OnModelCreating.
        // A Scoped registration would be disposed while the cached model persists.
        services.AddSingleton<IEncryptionService, EncryptionService>();

        // ── Repositories ──────────────────────────────────────────────────────
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IPatientRepository, PatientRepository>();
        services.AddScoped<IEnrollmentTokenRepository, EnrollmentTokenRepository>();
        services.AddScoped<ICareTeamRepository, CareTeamRepository>();
        services.AddScoped<IPostRepository, PostRepository>();
        services.AddScoped<ICommentRepository, CommentRepository>();
        services.AddScoped<IAttachmentRepository, AttachmentRepository>();
        services.AddScoped<ISessionRepository, SessionRepository>();
        services.AddScoped<INoteRepository, NoteRepository>();
        services.AddScoped<INotificationRepository, NotificationRepository>();
        services.AddScoped<ITherapeuticToolRepository, TherapeuticToolRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // ── Services ──────────────────────────────────────────────────────────
        services.AddScoped<IEmailService, EmailService>();
        services.AddScoped<IFileStorageService, SupabaseStorageService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IPatientService, PatientService>();
        services.AddScoped<IEnrollmentService, EnrollmentService>();
        services.AddScoped<IWallService, WallService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IInvitationService, InvitationService>();
        services.AddScoped<ISessionService, SessionService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<ITherapeuticToolService, TherapeuticToolService>();

        return services;
    }

    /// <summary>
    /// Registers the handwriting recognition proxy: the provider credentials (bound from the
    /// "Handwriting" section) and a named HttpClient carrying a timeout suited to a recognition
    /// round-trip, which is slower than a plain API call but far quicker than an LLM generation.
    /// </summary>
    public static IServiceCollection AddHandwritingServices(this IServiceCollection services, IConfiguration configuration)
    {
        var handwritingOptions = configuration.GetSection(HandwritingOptions.SectionName)
            .Get<HandwritingOptions>() ?? new HandwritingOptions();
        services.AddSingleton(handwritingOptions);

        services.AddHttpClient(HandwritingRecognitionService.HttpClientName, client =>
        {
            client.Timeout = TimeSpan.FromSeconds(30);
        });

        services.AddScoped<IHandwritingRecognitionService, HandwritingRecognitionService>();

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
