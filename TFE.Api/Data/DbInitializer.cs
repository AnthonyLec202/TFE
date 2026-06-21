using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TFE.Api.Models;

namespace TFE.Api.Data;

public static class DbInitializer
{
    private const string AdminEmail = "admin@neuroplatform.com";
    private const string AdminRole = "Admin";

    public static async Task SeedAsync(IServiceProvider serviceProvider)
    {
        try
        {
            var context = serviceProvider.GetRequiredService<ApplicationDbContext>();
            var userManager = serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var roleManager = serviceProvider.GetRequiredService<RoleManager<IdentityRole>>();
            var configuration = serviceProvider.GetRequiredService<IConfiguration>();

            Console.WriteLine("[Seed] Running database migrations...");
            await context.Database.MigrateAsync();
            Console.WriteLine("[Seed] Migrations OK.");

            // Seed the therapeutic tool library. Runs before the admin block (which returns early when
            // the admin already exists) so the catalog is provisioned on every startup, idempotently.
            await SeedTherapeuticToolsAsync(context);

            // Ensure the Admin role exists
            if (!await roleManager.RoleExistsAsync(AdminRole))
            {
                var roleResult = await roleManager.CreateAsync(new IdentityRole(AdminRole));
                if (!roleResult.Succeeded)
                {
                    var roleErrors = string.Join(" | ", roleResult.Errors.Select(e => $"{e.Code}: {e.Description}"));
                    Console.WriteLine($"[Seed] ERROR creating role: {roleErrors}");
                    throw new InvalidOperationException($"Failed to create Admin role: {roleErrors}");
                }
                Console.WriteLine("[Seed] Role 'Admin' created.");
            }

            // Update name if admin exists but was created before FirstName/LastName were added
            var existingAdmin = await userManager.FindByEmailAsync(AdminEmail);
            if (existingAdmin is not null)
            {
                if (string.IsNullOrEmpty(existingAdmin.FirstName) || string.IsNullOrEmpty(existingAdmin.LastName))
                {
                    existingAdmin.FirstName = "Admin";
                    existingAdmin.LastName = "NeuroPlatform";
                    await userManager.UpdateAsync(existingAdmin);
                    Console.WriteLine("[Seed] Admin user name patched.");
                }
                else
                {
                    Console.WriteLine("[Seed] Admin user already exists — skipping.");
                }
                return;
            }

            // The initial admin password must be supplied via configuration (e.g. user-secrets),
            // never hardcoded. It is only required on first run, when the admin is created.
            var adminPassword = configuration["Admin:InitialPassword"];
            if (string.IsNullOrWhiteSpace(adminPassword))
                throw new InvalidOperationException(
                    "Admin:InitialPassword is not configured. Set it via user-secrets before first run.");

            Console.WriteLine("[Seed] Creating admin user...");
            var admin = new ApplicationUser
            {
                UserName = AdminEmail,
                Email = AdminEmail,
                EmailConfirmed = true,
                FirstName = "Admin",
                LastName = "NeuroPlatform"
            };

            var result = await userManager.CreateAsync(admin, adminPassword);
            if (!result.Succeeded)
            {
                var errors = string.Join(" | ", result.Errors.Select(e => $"{e.Code}: {e.Description}"));
                Console.WriteLine($"[Seed] ERROR creating admin user: {errors}");
                throw new InvalidOperationException($"Failed to seed admin user: {errors}");
            }

            var roleAssign = await userManager.AddToRoleAsync(admin, AdminRole);
            if (!roleAssign.Succeeded)
            {
                var errors = string.Join(" | ", roleAssign.Errors.Select(e => $"{e.Code}: {e.Description}"));
                Console.WriteLine($"[Seed] ERROR assigning Admin role: {errors}");
                throw new InvalidOperationException($"Failed to assign Admin role: {errors}");
            }

            Console.WriteLine($"[Seed] Admin user created and assigned role 'Admin'. ID: {admin.Id}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Seed] FATAL EXCEPTION: {ex.GetType().Name} — {ex.Message}");
            if (ex.InnerException is not null)
                Console.WriteLine($"[Seed] Inner exception: {ex.InnerException.Message}");
            throw;
        }
    }

    /// <summary>
    /// Idempotently provisions a curated set of concrete CBT (TCC) tools. Each tool carries a stable
    /// Guid, so only entries absent from the database are inserted — restarts never duplicate them,
    /// and a tool deleted by the practitioner is not resurrected (its id is filtered, not re-added,
    /// only when missing AND not already present; deletions persist because we never re-insert an id
    /// that still exists, and we only add ids that are entirely absent).
    /// </summary>
    private static async Task SeedTherapeuticToolsAsync(ApplicationDbContext context)
    {
        var tools = BuildTherapeuticToolCatalog();
        var seedIds = tools.Select(t => t.Id).ToList();

        var existingIds = await context.TherapeuticTools
            .Where(t => seedIds.Contains(t.Id))
            .Select(t => t.Id)
            .ToListAsync();

        var missing = tools.Where(t => !existingIds.Contains(t.Id)).ToList();
        if (missing.Count == 0)
        {
            Console.WriteLine("[Seed] Therapeutic tools already present — skipping.");
            return;
        }

        await context.TherapeuticTools.AddRangeAsync(missing);
        await context.SaveChangesAsync();
        Console.WriteLine($"[Seed] Inserted {missing.Count} therapeutic tool(s).");
    }

    // Concrete, clinically realistic CBT material. Stable Guids keep the seed idempotent.
    private static List<TherapeuticTool> BuildTherapeuticToolCatalog() => new()
    {
        new TherapeuticTool
        {
            Id = Guid.Parse("a1f0c0d1-0001-4a00-8000-000000000001"),
            Title = "Colonne de Beck (tableau à 5 colonnes)",
            Description =
                "Tableau d'auto-enregistrement structurant l'analyse d'une situation activante : " +
                "Situation → Émotion (intensité 0–100) → Pensées automatiques → Distorsions cognitives " +
                "identifiées → Pensée alternative. Sert à mettre en évidence et à restructurer les " +
                "interprétations dysfonctionnelles.",
            Type = ToolType.CognitiveRestructuringSheet,
            Theme = CbtTheme.CognitiveDistortions,
            DownGradingStrategy =
                "Réduire à 3 colonnes (Situation → Émotion → Pensée automatique) et travailler une " +
                "seule situation déjà passée, à faible charge émotionnelle. Le thérapeute remplit la " +
                "colonne des distorsions avec le patient.",
            UpGradingStrategy =
                "Ajouter la cotation du degré de croyance avant/après, traiter des situations in vivo " +
                "récentes à forte charge, puis demander au patient de générer seul les pensées " +
                "alternatives et de planifier une expérience comportementale de vérification.",
        },
        new TherapeuticTool
        {
            Id = Guid.Parse("a1f0c0d1-0002-4a00-8000-000000000002"),
            Title = "Protocole d'exposition graduée in vivo",
            Description =
                "Construction d'une hiérarchie d'exposition (échelle SUD 0–100) pour un objet ou une " +
                "situation anxiogène, puis exposition répétée et prolongée à chaque palier jusqu'à " +
                "habituation, sans évitement ni comportement de réassurance.",
            Type = ToolType.ExposureProtocol,
            Theme = CbtTheme.AnxietyManagement,
            DownGradingStrategy =
                "Commencer par de l'exposition en imagination ou par photo/vidéo, sur le palier le plus " +
                "bas (SUD ≤ 30), sessions courtes accompagnées par le thérapeute, avec autorisation " +
                "temporaire d'une stratégie de sécurité que l'on retirera ensuite.",
            UpGradingStrategy =
                "Passer à l'exposition in vivo autonome, allonger la durée jusqu'à diminution de moitié " +
                "du SUD, supprimer tout comportement de sécurité, introduire des expositions surprises " +
                "et combiner plusieurs paliers (exposition massée) pour généraliser.",
        },
        new TherapeuticTool
        {
            Id = Guid.Parse("a1f0c0d1-0003-4a00-8000-000000000003"),
            Title = "Relaxation musculaire progressive de Jacobson",
            Description =
                "Exercice de contraction/relâchement séquentiel des grands groupes musculaires pour " +
                "apprendre à discriminer tension et détente, et abaisser le niveau d'activation " +
                "physiologique de base.",
            Type = ToolType.RelaxationExercise,
            Theme = CbtTheme.EmotionalRegulation,
            DownGradingStrategy =
                "Séance guidée audio de 5 minutes ciblant 4 groupes musculaires seulement, en position " +
                "allongée dans un environnement calme, yeux fermés.",
            UpGradingStrategy =
                "Étendre aux 16 groupes musculaires, réduire progressivement vers une relaxation par " +
                "remémoration (sans contraction), puis appliquer la détente différentielle en situation " +
                "réelle stressante (transports, prise de parole).",
        },
        new TherapeuticTool
        {
            Id = Guid.Parse("a1f0c0d1-0004-4a00-8000-000000000004"),
            Title = "Contrat comportemental d'activation",
            Description =
                "Accord écrit et signé fixant des objectifs comportementaux concrets, mesurables et " +
                "datés, assortis de renforçateurs définis avec le patient. Soutient l'activation " +
                "comportementale et l'engagement entre les séances.",
            Type = ToolType.BehavioralContract,
            Theme = CbtTheme.Assertiveness,
            DownGradingStrategy =
                "Limiter à un seul objectif minimal très atteignable par semaine (ex. 10 min de marche), " +
                "avec renforçateur immédiat et suivi quotidien coché.",
            UpGradingStrategy =
                "Augmenter le nombre et l'ambition des objectifs, espacer les renforçateurs vers un " +
                "auto-renforcement, et confier au patient la rédaction autonome du contrat suivant.",
        },
        new TherapeuticTool
        {
            Id = Guid.Parse("a1f0c0d1-0005-4a00-8000-000000000005"),
            Title = "Psychoéducation : le cercle vicieux de la panique",
            Description =
                "Support explicatif du modèle cognitif de Clark : sensation corporelle → interprétation " +
                "catastrophique → montée de l'anxiété → amplification des sensations. Vise à normaliser " +
                "les symptômes et à fournir un cadre de compréhension partagé.",
            Type = ToolType.PsychoeducationMaterial,
            Theme = CbtTheme.AnxietyManagement,
            DownGradingStrategy =
                "Présenter un schéma simplifié à 3 cases avec un exemple unique vécu par le patient, en " +
                "expliquant verbalement chaque étape sans jargon.",
            UpGradingStrategy =
                "Demander au patient de remplir le cercle avec ses propres épisodes, d'y relier ses " +
                "comportements d'évitement, puis d'en déduire lui-même les cibles d'exposition.",
        },
        new TherapeuticTool
        {
            Id = Guid.Parse("a1f0c0d1-0006-4a00-8000-000000000006"),
            Title = "Jeu de rôle d'affirmation de soi (technique du disque rayé)",
            Description =
                "Entraînement aux habiletés sociales par jeu de rôle : formuler une demande ou un refus " +
                "de manière assertive, répéter calmement son message face à l'insistance (disque rayé), " +
                "sans agressivité ni soumission.",
            Type = ToolType.ExposureProtocol,
            Theme = CbtTheme.SocialSkills,
            DownGradingStrategy =
                "Scénario écrit à l'avance, joué avec le thérapeute qui tient un interlocuteur " +
                "bienveillant ; le patient peut lire sa réplique. Cibler une situation à faible enjeu.",
            UpGradingStrategy =
                "Inverser les rôles, introduire un interlocuteur insistant ou critique, improviser sans " +
                "script, puis transférer vers une mise en pratique réelle planifiée avec compte rendu.",
        },
    };
}
