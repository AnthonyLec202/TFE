using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using TFE.Api.Models;

namespace TFE.Api.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<CareTeam> CareTeams => Set<CareTeam>();
    public DbSet<EnrollmentToken> EnrollmentTokens => Set<EnrollmentToken>();
    public DbSet<Post> Posts => Set<Post>();
    public DbSet<Comment> Comments => Set<Comment>();
    public DbSet<Attachment> Attachments => Set<Attachment>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<SessionAttendance> SessionAttendances => Set<SessionAttendance>();
    public DbSet<SessionNote> SessionNotes => Set<SessionNote>();
    public DbSet<Note> Notes => Set<Note>();
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // CareTeam: composite primary key
        builder.Entity<CareTeam>()
            .HasKey(ct => new { ct.UserId, ct.PatientId });

        builder.Entity<CareTeam>()
            .HasOne(ct => ct.User)
            .WithMany(u => u.CareTeamMemberships)
            .HasForeignKey(ct => ct.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<CareTeam>()
            .HasOne(ct => ct.Patient)
            .WithMany(p => p.CareTeam)
            .HasForeignKey(ct => ct.PatientId)
            .OnDelete(DeleteBehavior.Cascade);

        // EnrollmentToken: deleting a patient cascades to its tokens (intentional)
        builder.Entity<EnrollmentToken>()
            .HasOne(et => et.Patient)
            .WithMany(p => p.EnrollmentTokens)
            .HasForeignKey(et => et.PatientId)
            .OnDelete(DeleteBehavior.Cascade);

        // Post
        builder.Entity<Post>()
            .Property(p => p.ExcludedRoles)
            .HasColumnType("text[]");

        builder.Entity<Post>()
            .HasOne(p => p.Patient)
            .WithMany(p => p.Posts)
            .HasForeignKey(p => p.PatientId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<Post>()
            .HasOne(p => p.CreatedBy)
            .WithMany()
            .HasForeignKey(p => p.CreatedById)
            .OnDelete(DeleteBehavior.SetNull);

        // Comment
        builder.Entity<Comment>()
            .HasOne(c => c.Post)
            .WithMany(p => p.Comments)
            .HasForeignKey(c => c.PostId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<Comment>()
            .HasOne(c => c.CreatedBy)
            .WithMany()
            .HasForeignKey(c => c.CreatedById)
            .OnDelete(DeleteBehavior.SetNull);

        // Attachment: XOR check — must belong to exactly one parent (Post OR Comment)
        builder.Entity<Attachment>()
            .ToTable(t => t.HasCheckConstraint(
                "CK_Attachment_Parent",
                "(\"PostId\" IS NOT NULL AND \"CommentId\" IS NULL) OR (\"PostId\" IS NULL AND \"CommentId\" IS NOT NULL)"));

        builder.Entity<Attachment>()
            .Property(a => a.FileName)
            .HasColumnName("FileName");

        builder.Entity<Attachment>()
            .Property(a => a.FileType)
            .HasColumnName("FileType");

        builder.Entity<Attachment>()
            .HasOne(a => a.Post)
            .WithMany(p => p.Attachments)
            .HasForeignKey(a => a.PostId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<Attachment>()
            .HasOne(a => a.Comment)
            .WithMany(c => c.Attachments)
            .HasForeignKey(a => a.CommentId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<Attachment>()
            .HasOne(a => a.CreatedBy)
            .WithMany()
            .HasForeignKey(a => a.CreatedById)
            .OnDelete(DeleteBehavior.SetNull);

        // Session ↔ Patient: many-to-many with explicit join table
        // Cascade on both sides so the join row is removed when either party is deleted.
        builder.Entity<Session>()
            .HasMany(s => s.Patients)
            .WithMany(p => p.Sessions)
            .UsingEntity<Dictionary<string, object>>(
                "PatientSession",
                r => r.HasOne<Patient>().WithMany()
                      .HasForeignKey("PatientsId")
                      .OnDelete(DeleteBehavior.Cascade),
                l => l.HasOne<Session>().WithMany()
                      .HasForeignKey("SessionsId")
                      .OnDelete(DeleteBehavior.Cascade),
                j => j.HasKey("SessionsId", "PatientsId")
            );

        // Session → SessionAttendance: one-to-many; attendance rows are owned by the session and
        // removed with it.
        builder.Entity<Session>()
            .HasMany(s => s.Attendances)
            .WithOne(a => a.Session)
            .HasForeignKey(a => a.SessionId)
            .OnDelete(DeleteBehavior.Cascade);

        // Session → Note: one-to-one; note is owned by the session
        builder.Entity<Session>()
            .HasOne(s => s.Note)
            .WithOne(n => n.Session)
            .HasForeignKey<Note>(n => n.SessionId)
            .OnDelete(DeleteBehavior.Cascade);

        // SessionNote
        builder.Entity<SessionNote>()
            .HasOne(sn => sn.Session)
            .WithMany(s => s.SessionNotes)
            .HasForeignKey(sn => sn.SessionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<SessionNote>()
            .HasOne(sn => sn.CreatedBy)
            .WithMany()
            .HasForeignKey(sn => sn.CreatedById)
            .OnDelete(DeleteBehavior.SetNull);

        // Notification: deleting the recipient or the referenced patient deletes their notifications
        builder.Entity<Notification>()
            .HasOne(n => n.User)
            .WithMany()
            .HasForeignKey(n => n.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<Notification>()
            .HasOne(n => n.Patient)
            .WithMany()
            .HasForeignKey(n => n.PatientId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
