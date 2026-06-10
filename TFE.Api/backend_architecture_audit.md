# Backend Architecture Audit — TFE.Api

**Scope:** All `*.cs` files under `TFE.Api/` (excluding `bin/`, `obj/`, `Migrations/`).
**Reference:** CLAUDE.md, Section 3 — Backend Architecture: N-Tier / Layered Pattern.
**Mode:** Read-only audit. No files were modified.

---

## Summary Table

| # | Area | Violation | Severity |
|---|------|-----------|----------|
| 1.1 | `Services/Sessions/SessionService.cs` | Service performs all data access directly via `ApplicationDbContext` — no `ISessionRepository`/`INoteRepository` exists | High |
| 1.2 | `Services/CollaborativeWall/WallService.cs` | Service performs all CRUD for `Post`, `Comment`, `Attachment`, `CareTeam` directly via `ApplicationDbContext` — no corresponding repositories exist | High |
| 1.3 | `Services/Patients/UserService.cs` | Service queries/mutates `Posts`, `Comments`, `Attachments` directly via `ApplicationDbContext` for GDPR anonymisation | High |
| 1.4 | `Services/Patients/PatientService.cs`, `Services/Auth/EnrollmentService.cs` | Services inject `ApplicationDbContext` solely to open/commit/rollback transactions spanning multiple repositories (no Unit-of-Work abstraction) | Medium |
| 2.1 | `Interfaces/IServices/CollaborativeWall/IStorageService.cs` vs `IFileStorageService.cs` | Two parallel, inconsistent storage abstractions for the same domain concern | Medium |
| 2.2 | `Services/CollaborativeWall/DummyStorageService.cs` | No-op storage implementation registered in production DI, silently used for GDPR file-deletion (`UserService`) | Medium (functional risk, flagged for awareness) |
| 3 | Controllers | None found — all controllers are thin, DTO-only, properly delegate to services | ✅ Compliant |
| 4 | DTO Mapping / Model Exposure | None found — all responses are mapped to DTOs inside Services | ✅ Compliant |
| 5 | Dependency Injection | None found — no `new Service()` / `new Repository()`; all dependencies are interface-injected and registered in `ServiceCollectionExtensions` | ✅ Compliant |
| 6 | Missing Interfaces | None for existing Repositories/Services — every concrete class implements an interface | ✅ Compliant (but see 1.1–1.3: missing repositories entirely) |
| 7 | Naming Conventions | Consistent (`I` prefix, `Service`/`Repository` suffixes, English identifiers) | ✅ Compliant |

---

## 1. Repository Pattern Bypass (Fat Services / Direct DbContext Access)

CLAUDE.md §3 states repositories are *"the single source of truth for data access"* and that *"layers must only communicate through injected interfaces (e.g., ... Service -> `IRepository`)"*. The following services inject `ApplicationDbContext` directly and perform CRUD/queries that should live in a Repository.

### 1.1 `Services/Sessions/SessionService.cs` — No repository layer at all

```csharp
public class SessionService : ISessionService
{
    private readonly ApplicationDbContext _context;
    ...
    public async Task SyncBatchAsync(SessionSyncBatchRequest request, CancellationToken cancellationToken)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        ...
        await UpsertSessionsAsync(uniqueSessions, cancellationToken);   // queries _context.Sessions, _context.Patients
        await DeleteExistingNotesBySessionIdAsync(uniqueNotes, cancellationToken); // queries _context.Notes
        ...
        InsertNotes(uniqueNotes); // _context.Notes.Add(...)
    }
}
```

- `UpsertSessionsAsync`, `DeleteExistingNotesBySessionIdAsync`, and `InsertNotes` are pure data-access operations (EF Core queries + `Add`/`Remove`/`SaveChanges`) embedded as private methods inside the service.
- There is **no `ISessionRepository`** or **`INoteRepository`** in `Interfaces/IRepositories/`, and no corresponding implementation in `Repositories/`.
- The transaction-management/dedup orchestration (business logic — "keep the most recent entry per id") is legitimately service-layer logic and should remain; only the raw EF queries/mutations should be extracted.

**Recommendation:** Introduce `ISessionRepository` (e.g., `GetByIdsWithPatientsAsync`, `AddOrUpdateAsync`) and `INoteRepository` (e.g., `RemoveBySessionIdsAsync`, `AddRangeAsync`), and have `SessionService` orchestrate them while keeping the dedup/business rules.

### 1.2 `Services/CollaborativeWall/WallService.cs` — No `Post`/`Comment`/`Attachment` repositories

`WallService` injects `ApplicationDbContext` and performs direct queries/mutations across the entire wall feature:

```csharp
private Task<CareTeam?> GetCareTeamEntryAsync(string userId, Guid patientId)
    => _context.CareTeams.FirstOrDefaultAsync(ct => ct.UserId == userId && ct.PatientId == patientId);

private Task<Dictionary<string, CareTeam>> GetPatientCareTeamMapAsync(Guid patientId)
    => _context.CareTeams.Include(ct => ct.User).Where(ct => ct.PatientId == patientId).ToDictionaryAsync(ct => ct.UserId);

var posts = await _context.Posts
    .Where(p => p.PatientId == patientId)
    .Where(p => isAdmin || !p.ExcludedRoles.Any(r => r == userRelationshipRole))
    .Include(p => p.Comments.OrderBy(c => c.CreatedAt)).ThenInclude(c => c.Attachments)
    .Include(p => p.Attachments)
    .OrderByDescending(p => p.CreatedAt)
    .ToListAsync();

_context.Posts.Add(post);
_context.Attachments.Add(new Attachment { ... });
_context.Comments.Add(comment);
_context.Posts.Remove(post);
_context.Comments.Remove(comment);
await _context.SaveChangesAsync();
```

- `ICareTeamRepository` already exists (used elsewhere) but `WallService` re-implements its own `CareTeam` queries against `_context.CareTeams` instead of extending/reusing `ICareTeamRepository`.
- No `IPostRepository`, `ICommentRepository`, or `IAttachmentRepository` exist anywhere in `Interfaces/IRepositories/` or `Repositories/`.
- This is the largest service in the codebase (450 lines) and mixes three concerns: authorization/business rules (24-hour edit window, role-based visibility), DTO mapping, and raw data access.

**Recommendation:**
- Extend `ICareTeamRepository` with the methods `WallService` needs (`GetByUserAndPatientAsync` already exists as `GetForUserAndPatientAsync`; add `GetByPatientWithUsersAsync` for the map).
- Introduce `IPostRepository` (`GetWallForPatientAsync`, `GetByIdWithDetailsAsync`, `AddAsync`, `RemoveAsync`) and `ICommentRepository`/`IAttachmentRepository` (or a combined `IAttachmentRepository` shared by both).
- Keep `ResolveRole`, `LabelForCareTeam`, `ValidateModificationRightsAsync`, and the `To*Response` mapping methods in the service — these are business rules / DTO mapping, correctly placed.

### 1.3 `Services/Patients/UserService.cs` — Direct `Posts`/`Comments`/`Attachments` access for GDPR deletion

```csharp
var posts = await _context.Posts
    .Include(p => p.Attachments)
    .Where(p => p.CreatedById == userId)
    .ToListAsync();

var comments = await _context.Comments
    .Include(c => c.Attachments)
    .Where(c => c.CreatedById == userId)
    .ToListAsync();

foreach (var post in posts)
{
    foreach (var att in post.Attachments)
    {
        await _storageService.DeleteFileAsync(att.FileUrl);
        _context.Attachments.Remove(att);
    }
    post.Content = DeletedContent;
}
...
await _context.SaveChangesAsync();
```

- Same root cause as 1.2 — without `IPostRepository`/`ICommentRepository`/`IAttachmentRepository`, `UserService` has no choice but to query `ApplicationDbContext` directly.
- The anonymisation rule (`post.Content = DeletedContent`) is correctly business logic and belongs in the service; the queries/removals should go through repositories.

**Recommendation:** Once `IPostRepository`/`ICommentRepository`/`IAttachmentRepository` exist (per 1.2), reuse them here (e.g., `GetByAuthorWithAttachmentsAsync`, `RemoveAttachmentsAsync`).

### 1.4 `PatientService` and `EnrollmentService` — `ApplicationDbContext` injected only for transaction scope

```csharp
// PatientService
public PatientService(ApplicationDbContext context, IPatientRepository patientRepository, ICareTeamRepository careTeamRepository)
{
    _context = context; ...
}

public async Task<PatientResponse> CreatePatientAsync(CreatePatientRequest request, string currentUserId)
{
    await using var transaction = await _context.Database.BeginTransactionAsync();
    try
    {
        ... await _patientRepository.CreateAsync(patient);
        ... await _careTeamRepository.CreateAsync(careTeam);
        await transaction.CommitAsync();
    }
    catch { await transaction.RollbackAsync(); throw; }
}
```

This is a **lesser** violation than 1.1–1.3: all entity reads/writes do go through `IPatientRepository`/`ICareTeamRepository`. The only direct `ApplicationDbContext` usage is `Database.BeginTransactionAsync()/CommitAsync()/RollbackAsync()` — i.e., cross-repository transaction (Unit of Work) coordination, for which the Repository interfaces provide no abstraction.

`EnrollmentService.ConsumeTokenAsync` follows the identical pattern (transaction wraps `IEnrollmentTokenRepository`, `IUserRepository`, `ICareTeamRepository` calls).

**Recommendation:** Introduce an `IUnitOfWork` (or `ITransactionManager`) interface wrapping `BeginTransactionAsync`/`CommitAsync`/`RollbackAsync`, injected instead of `ApplicationDbContext`, so Services never reference `Data.ApplicationDbContext` directly. This keeps the transactional orchestration (legitimate business logic) in the Service while removing the last `Data`-layer dependency.

---

## 2. Storage Service Duplication

Two interfaces exist for what is conceptually one concern (file storage for attachments):

```csharp
// Interfaces/IServices/CollaborativeWall/IStorageService.cs
public interface IStorageService
{
    Task<string> UploadFileAsync(IFormFile file);
    Task DeleteFileAsync(string fileUrl);
}

// Interfaces/IServices/CollaborativeWall/IFileStorageService.cs
public interface IFileStorageService
{
    Task<string> UploadFileAsync(IFormFile file, string bucketName, CancellationToken cancellationToken = default);
    Task DeleteFileAsync(string fileUrl, string bucketName);
}
```

DI registration (`ServiceCollectionExtensions.cs`):

```csharp
services.AddScoped<IStorageService, DummyStorageService>();      // used by UserService (GDPR deletion)
services.AddScoped<IFileStorageService, SupabaseStorageService>(); // used by WallService (real uploads/deletes)
```

- `DummyStorageService.DeleteFileAsync(string fileUrl)` only logs and returns `Task.CompletedTask` — it never calls Supabase. Since this is the implementation registered for `IStorageService`, **`UserService.DeleteUserAsync` (GDPR Right to Erasure) does not actually delete attachment files from Supabase Storage**, even though it removes the `Attachment` rows from the database. This is a functional/compliance risk, not just a naming issue, and is flagged here because it stems directly from the duplicated-interface architecture.
- `IStorageService` and `IFileStorageService` differ only in signature (bucket name + cancellation token), creating two parallel abstractions for the same responsibility — a violation of the spirit of "Interfaces: Contracts defining the methods for Services... essential for DI and mockable, testable code" (one coherent contract per responsibility).

**Recommendation:** Consolidate into a single `IFileStorageService` (the `SupabaseStorageService` contract, which already supports bucket name + cancellation token). Update `UserService` to depend on `IFileStorageService` and pass the configured attachments bucket (same `Supabase:AttachmentsBucket` config key already used by `WallService`). Remove `IStorageService` and `DummyStorageService`, or repurpose `DummyStorageService` as a `IFileStorageService` test double if needed for local/dev environments (registered conditionally, not unconditionally in production DI).

---

## 3. Controllers — ✅ Compliant

All 7 controllers (`AuthController`, `EnrollmentController`, `WallController`, `InvitationsController`, `PatientsController`, `UsersController`, `SessionSyncController`) were reviewed:

- Each controller depends only on `I*Service` interfaces via constructor injection.
- No LINQ/EF queries, no `ApplicationDbContext`, no business rules (role checks, validation logic) inside controllers.
- Controllers only translate service results/exceptions (`UnauthorizedAccessException` → `Forbid()`, `KeyNotFoundException` → `NotFound()`, `InvalidOperationException`/`ArgumentException`/`ValidationException` → `BadRequest()`) into HTTP status codes.
- All responses are DTOs (`AuthResponse`, `PatientResponse`, `PostResponse`, `InvitationResponse`, etc.) — no `Models` namespace types are ever returned.

---

## 4. DTO Mapping / Model Exposure — ✅ Compliant

- `PatientService.ToResponse`, `WallService.ToPostResponse`/`ToCommentResponse`/`ToAttachmentResponse`, `EnrollmentService`'s `InvitationResponse` construction, and `AuthService`'s `AuthResponse` construction all map `Models.*` → `DTOs.*` inside the Service layer before returning to the Controller.
- No controller action returns a raw `Patient`, `Post`, `Comment`, `ApplicationUser`, etc.

---

## 5. Dependency Injection — ✅ Compliant

- A repo-wide search for `new \w*(Service|Repository)\(` returned **no matches** — no class manually instantiates a Service or Repository.
- All Services and Repositories are registered against their interfaces in `Extensions/ServiceCollectionExtensions.cs` via `AddScoped<IXxx, Xxx>()`.
- `EnrollmentService` depends on `IAuthService` (not `AuthService`), `WallService` depends on `IFileStorageService`, `UserService` depends on `IStorageService` and `UserManager<ApplicationUser>` (an ASP.NET Identity-provided abstraction) — all interface/framework-abstraction based.

---

## 6. Missing Interfaces — Mostly ✅, with gaps noted in Section 1

- Every existing concrete Repository (`CareTeamRepository`, `EnrollmentTokenRepository`, `PatientRepository`, `UserRepository`) implements a corresponding interface (`I*Repository`).
- Every existing concrete Service implements a corresponding `I*Service` interface.
- The gap is not "missing interfaces for existing classes" but **entirely missing repository abstractions** for `Session`, `Note`, `Post`, `Comment`, and `Attachment` entities (see 1.1–1.3) — these entities are accessed exclusively via raw `ApplicationDbContext` calls embedded in Services.

---

## 7. Naming Conventions — ✅ Compliant

- All interfaces are prefixed with `I` (`IPatientService`, `ICareTeamRepository`, `IFileStorageService`, ...).
- All service classes use the `Service` suffix (`PatientService`, `WallService`, `AuthService`, `EnrollmentService`, `InvitationService`, `SessionService`, `UserService`, `EmailService`, `DummyStorageService`, `SupabaseStorageService`).
- All repository classes use the `Repository` suffix (`PatientRepository`, `CareTeamRepository`, `EnrollmentTokenRepository`, `UserRepository`).
- All controllers use the `Controller` suffix and route via `[Route]`/`[ApiController]`.
- All identifiers (classes, methods, properties, DTOs) are in English; only string literals (user-facing labels like `"Psychologue"`, `"Logopède"`) and a few inline comments are in French — acceptable since CLAUDE.md restricts the *naming convention* requirement to identifiers, not user-facing copy or prose comments.
- One minor inconsistency: `IStorageService` vs `IFileStorageService` (see Section 2) — both describe "file storage" but use different naming/signature conventions for the same concern.

---

## Recommended Remediation Order

1. **Introduce `IPostRepository`, `ICommentRepository`, `IAttachmentRepository`** and migrate `WallService`'s direct `_context.Posts/.Comments/.Attachments` access into them (Section 1.2). This is the highest-impact change — `WallService` is the largest and most DbContext-coupled service.
2. **Introduce `ISessionRepository`/`INoteRepository`** and migrate `SessionService`'s private upsert/delete/insert helpers into them (Section 1.1).
3. **Reuse the new `IPostRepository`/`ICommentRepository`/`IAttachmentRepository` in `UserService`** for GDPR anonymisation (Section 1.3).
4. **Consolidate `IStorageService`/`IFileStorageService`** into one interface and fix the GDPR file-deletion gap caused by `DummyStorageService` (Section 2).
5. **(Optional/lower priority)** Introduce an `IUnitOfWork`/`ITransactionManager` abstraction to remove the remaining `ApplicationDbContext` references from `PatientService` and `EnrollmentService` (Section 1.4).
