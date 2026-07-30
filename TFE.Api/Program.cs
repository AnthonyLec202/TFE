using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.SignalR;
using Scalar.AspNetCore;
using TFE.Api.Data;
using TFE.Api.Extensions;
using TFE.Api.Hubs;
using TFE.Api.Hubs.CollaborativeWall;
using TFE.Api.Models;
using TFE.Api.Options;

var builder = WebApplication.CreateBuilder(args);

// ── Database ──────────────────────────────────────────────────────────────────
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ── Identity ──────────────────────────────────────────────────────────────────
builder.Services.AddIdentityCore<ApplicationUser>(options =>
{
    // Simplified password policy: a single rule — a minimum length of 6 characters. The application
    // targets users who are not necessarily comfortable with technology, so complexity requirements
    // (digit, lowercase, uppercase, special character) are intentionally disabled.
    options.Password.RequiredLength = 6;
    options.Password.RequireDigit = false;
    options.Password.RequireLowercase = false;
    options.Password.RequireUppercase = false;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequiredUniqueChars = 1;
})
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

// Persist Data Protection keys so password-reset tokens survive app restarts
// (without persistence the keys regenerate on boot, silently invalidating outstanding links).
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(
        Path.Combine(builder.Environment.ContentRootPath, "DataProtection-Keys")));

// Bound the lifetime of password-reset (and other default) tokens.
builder.Services.Configure<DataProtectionTokenProviderOptions>(options =>
    options.TokenLifespan = TimeSpan.FromHours(2));

// ── Options binding ─────────────────────────────────────────────────────────
builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection(EmailOptions.SectionName));
builder.Services.Configure<AppOptions>(builder.Configuration.GetSection(AppOptions.SectionName));

// ── JWT — fail-fast validation ────────────────────────────────────────────────
var jwtKey     = builder.Configuration["Jwt:Key"];
var jwtIssuer  = builder.Configuration["Jwt:Issuer"];
var jwtAudience = builder.Configuration["Jwt:Audience"];

if (string.IsNullOrEmpty(jwtKey) || string.IsNullOrEmpty(jwtIssuer) || string.IsNullOrEmpty(jwtAudience))
    throw new InvalidOperationException(
        "JWT configuration is missing from appsettings.json. " +
        "Ensure 'Jwt:Key', 'Jwt:Issuer', and 'Jwt:Audience' are set.");

// ── JWT Authentication ────────────────────────────────────────────────────────
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = jwtIssuer,
            ValidAudience            = jwtAudience,
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew                = TimeSpan.FromMinutes(5)
        };

        // The JWT is delivered exclusively in an HttpOnly cookie (F-02), so it is unreadable by
        // JavaScript and never travels in an Authorization header or query string. Extract it from
        // the cookie for every request — including the SignalR handshake, whose WebSocket upgrade
        // carries the same-site cookie automatically when the client connects with credentials.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                context.Token = context.Request.Cookies[AuthCookieExtensions.AuthCookieName];
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddSignalR();
builder.Services.AddSingleton<IUserIdProvider, NameIdentifierUserIdProvider>();

// ── Rate limiting ───────────────────────────────────────────────────────────
// Protects the email-dispatch endpoint (and the Brevo free-tier quota) from abuse:
// at most 3 forgot-password requests per 15-minute window, partitioned by client IP.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("ForgotPasswordPolicy", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 3,
                Window = TimeSpan.FromMinutes(15),
                QueueLimit = 0,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            }));

    // Handwriting recognition is billed per call against a third-party quota. Now that the provider
    // credentials live on the server rather than in the browser, the client can no longer be trusted
    // to bound usage — so the endpoint does. The partition key is the authenticated principal, the IP
    // being only a fallback: this deployment serves a single clinician, so the point is not to divide
    // a budget between users but to keep an unauthenticated caller sharing their address (CGNAT,
    // public Wi-Fi) from consuming it. This requires UseRateLimiter to run after UseAuthentication —
    // see the pipeline order below.
    options.AddPolicy("HandwritingPolicy", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.User.Identity?.Name
                ?? httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? httpContext.Connection.RemoteIpAddress?.ToString()
                ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                // A conversion covers a page of handwriting, so a clinician needs a handful per
                // session, not dozens per minute.
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(5),
                QueueLimit = 0,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            }));
});

// ── CORS ──────────────────────────────────────────────────────────────────────
// Origins come from the "Cors" section so the same build serves the Vite dev server locally and the
// deployed frontend in production, with no code change between environments.
var corsOptions = builder.Configuration.GetSection(FrontendCorsOptions.SectionName)
    .Get<FrontendCorsOptions>() ?? new FrontendCorsOptions();
corsOptions.Validate();

builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsOptions.PolicyName, policy =>
        // SetIsOriginAllowed rather than WithOrigins: the predicate covers the exact allow-list and
        // the optional deployment-preview patterns in one place (see FrontendCorsOptions).
        policy.SetIsOriginAllowed(corsOptions.IsOriginAllowed)
              .AllowAnyHeader()
              .AllowAnyMethod()
              // SignalR negotiates with credentials mode 'include'; the browser then requires
              // the response to carry 'Access-Control-Allow-Credentials: true'. Valid here
              // because origins are explicit (AllowCredentials is incompatible with AllowAnyOrigin).
              .AllowCredentials());
});

// ── Supabase client (singleton) + Repositories & Services ────────────────────
builder.Services.AddSupabaseClient(builder.Configuration);
builder.Services.AddAiServices(builder.Configuration);
builder.Services.AddHandwritingServices(builder.Configuration);
builder.Services.AddApplicationServices();

// ─────────────────────────────────────────────────────────────────────────────
var app = builder.Build();

// ── Seed database ─────────────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    try
    {
        await DbInitializer.SeedAsync(scope.ServiceProvider);
    }
    catch (Exception ex)
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred while seeding the database.");
    }
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseHttpsRedirection();
app.UseCors(FrontendCorsOptions.PolicyName);
app.UseAuthentication();
app.UseAuthorization();
// After authentication, and deliberately so. A rate-limiting policy that partitions on the caller's
// identity reads HttpContext.User, which is populated by UseAuthentication; placed any earlier, every
// such partition key silently falls through to the IP address and the per-user quota becomes a
// per-address one. Do not move this line back up the pipeline.
app.UseRateLimiter();
app.MapControllers();

// Anonymous liveness probe for the client's global network-reachability poll. Deliberately trivial
// (no DB, no auth) so it answers fast and a failure means "backend unreachable", not "request denied".
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.MapHub<CollaborativeWallHub>("/hubs/collaborative-wall");

app.Run();
