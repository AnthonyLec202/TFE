using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using TFE.Api.Data.Converters;
using TFE.Api.Interfaces.IServices.Encryption;
using TFE.Api.Models;

namespace TFE.Api.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    private readonly IEncryptionService _encryptionService;

    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options,
        IEncryptionService encryptionService)
        : base(options)
    {
        _encryptionService = encryptionService;
    }

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
    public DbSet<TherapeuticTool> TherapeuticTools => Set<TherapeuticTool>();

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

        // Session ↔ TherapeuticTool: many-to-many with an explicit join table.
        // The join row is purely associative (no payload), so cascade on both sides removes it when
        // either the session or the tool is deleted — deleting a tool from the library detaches it
        // from past sessions without deleting the sessions, and vice-versa.
        builder.Entity<TherapeuticTool>()
            .HasMany(t => t.Sessions)
            .WithMany(s => s.TherapeuticTools)
            .UsingEntity<Dictionary<string, object>>(
                "SessionTherapeuticTool",
                r => r.HasOne<Session>().WithMany()
                      .HasForeignKey("SessionsId")
                      .OnDelete(DeleteBehavior.Cascade),
                l => l.HasOne<TherapeuticTool>().WithMany()
                      .HasForeignKey("TherapeuticToolsId")
                      .OnDelete(DeleteBehavior.Cascade),
                j => j.HasKey("TherapeuticToolsId", "SessionsId")
            );

        // TherapeuticTool: persist the enums as integers (default) and index the discriminating
        // columns the catalog filters on. Title/Description/strategies are practitioner-authored
        // reference material (not patient PII), so they stay cleartext for indexing and search.
        builder.Entity<TherapeuticTool>()
            .HasIndex(t => t.Type);
        builder.Entity<TherapeuticTool>()
            .HasIndex(t => t.Theme);

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

        // Field-level encryption for all PII and clinical content columns (GDPR Art. 32).
        // One stateless converter instance is shared across all encrypted properties.
        var encryptedStringConverter = new EncryptedStringConverter(_encryptionService);

        builder.Entity<Patient>()
            .Property(p => p.FirstName)
            .HasConversion(encryptedStringConverter);
        builder.Entity<Patient>()
            .Property(p => p.LastName)
            .HasConversion(encryptedStringConverter);

        // Session note clinical content. This is the entity the offline-first client syncs into
        // (SessionService.InsertNotesAsync → new Note { Content = ... }), so it is the column that
        // was previously landing in Supabase as cleartext.
        builder.Entity<Note>()
            .Property(n => n.Content)
            .HasConversion(encryptedStringConverter);

        // Session title only — Date and Time stay cleartext (they are not PII and remain usable
        // for indexing/sorting). Title can carry the patient's name or clinical context.
        builder.Entity<Session>()
            .Property(s => s.Title)
            .HasConversion(encryptedStringConverter);

        // SessionNote is a separate clinical-content entity (not currently on the sync path).
        // Encrypted as defense-in-depth so any future write is protected at rest.
        builder.Entity<SessionNote>()
            .Property(sn => sn.ContentText)
            .HasConversion(encryptedStringConverter);

        // Collaborative wall post content (nullable — EF Core skips the converter for null values,
        // so the ValueConverter<string, string> is safe on a string? column at runtime).
#pragma warning disable CS8620
        builder.Entity<Post>()
            .Property(p => p.Content)
            .HasConversion(encryptedStringConverter);
#pragma warning restore CS8620

        // Notification actor: second FK from Notification to ApplicationUser.
        // SetNull on actor deletion so a GDPR erasure of a user does not cascade-delete
        // the notification from other recipients' inboxes.
        builder.Entity<Notification>()
            .HasOne(n => n.Actor)
            .WithMany()
            .HasForeignKey(n => n.ActorId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
