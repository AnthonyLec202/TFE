using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TFE.Api.Models;

namespace TFE.Api.Data;

public static class DbInitializer
{
    private const string AdminEmail = "admin@neuroplatform.com";
    private const string AdminPassword = "AdminPassword123!";
    private const string AdminRole = "Admin";

    public static async Task SeedAsync(IServiceProvider serviceProvider)
    {
        try
        {
            var context = serviceProvider.GetRequiredService<ApplicationDbContext>();
            var userManager = serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var roleManager = serviceProvider.GetRequiredService<RoleManager<IdentityRole>>();

            Console.WriteLine("[Seed] Running database migrations...");
            await context.Database.MigrateAsync();
            Console.WriteLine("[Seed] Migrations OK.");

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

            Console.WriteLine("[Seed] Creating admin user...");
            var admin = new ApplicationUser
            {
                UserName = AdminEmail,
                Email = AdminEmail,
                EmailConfirmed = true,
                FirstName = "Admin",
                LastName = "NeuroPlatform"
            };

            var result = await userManager.CreateAsync(admin, AdminPassword);
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
}
