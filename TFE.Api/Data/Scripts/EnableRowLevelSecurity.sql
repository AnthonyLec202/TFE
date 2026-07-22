-- ============================================================================
-- Enable Row Level Security (RLS) on every table in the public schema.
--
-- Purpose:
--   Lock down the Supabase Data API (PostgREST) so that no table is readable
--   or writable through the auto-generated REST/GraphQL endpoints using the
--   anon or authenticated API keys.
--
-- Rationale:
--   This application never queries Supabase tables from the browser. All
--   database reads and writes are performed exclusively by the .NET API through
--   Entity Framework Core over a direct PostgreSQL connection. Supabase is used
--   only for (a) the managed PostgreSQL instance and (b) Supabase Storage
--   (server-side file uploads with signed URLs).
--
-- Effect:
--   * Enabling RLS with NO policies makes PostgREST return zero rows for reads
--     and reject all writes for the anon/authenticated roles.
--   * The privileged PostgreSQL role used by the .NET connection string
--     (the table owner / service role) BYPASSES RLS, so Entity Framework Core
--     access is completely unaffected.
--   * No permissive policies are created intentionally — external Data API
--     access stays fully denied.
--
-- Idempotent: ENABLE ROW LEVEL SECURITY is safe to run repeatedly.
-- ============================================================================

BEGIN;

-- ASP.NET Core Identity tables ------------------------------------------------
ALTER TABLE "AspNetRoles"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AspNetRoleClaims"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AspNetUsers"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AspNetUserClaims"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AspNetUserLogins"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AspNetUserRoles"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AspNetUserTokens"      ENABLE ROW LEVEL SECURITY;

-- Application domain tables ---------------------------------------------------
ALTER TABLE "Patients"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CareTeams"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EnrollmentTokens"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Posts"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Comments"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attachments"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Sessions"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionAttendances"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionNotes"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notes"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notifications"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TherapeuticTools"      ENABLE ROW LEVEL SECURITY;

-- Many-to-many join tables ----------------------------------------------------
ALTER TABLE "PatientSession"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionTherapeuticTool" ENABLE ROW LEVEL SECURITY;

-- EF Core migrations history --------------------------------------------------
ALTER TABLE "__EFMigrationsHistory" ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- Verification query — every table below should report rowsecurity = true.
-- ============================================================================
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
