# Frontend Architecture Audit

Audit of `frontend/src` against the Container/Presentational + Feature-Driven rules defined in `CLAUDE.MD` (Section 2). No files were modified — this is a read-only report.

Overall: `features/collaborativeWall`, `features/invitations`, `features/sessions` and `features/auth` (containers) comply with the Container/Presentational split and the `index.ts` façade rule. Violations are concentrated in `features/patients`, `pages/patients`, and the `core/offline/` cross-cutting layer.

---

## 1. `features/patients`

### 1.1 `PrivatePageView.tsx` — container-in-disguise, missing `Container` suffix
**File:** `src/features/patients/PrivatePageView.tsx`

- Holds 5 pieces of local state (`selectedRole`, `generating`, `invitation`, `inviteError`, `copied`).
- Performs a side-effecting API call (`generateInvitation` from `src/services/patientService`) and a `navigator.clipboard` side effect.
- Lives at the feature root but has neither the `Container` suffix nor a pure-presentational shape.

**Violates:** Rule 1 (Container/Presentational split) and Rule 5 (naming convention).

**Additional issue — duplication:** This component re-implements the exact "generate invitation code" flow that already exists as `features/invitations/InvitationContainer` + `useGenerateInvitation` + `InvitationModal` (used elsewhere from `PatientDetailContainer`). Two parallel implementations of the same business rule (role selection, code generation, expiry display, copy-to-clipboard) now exist.

**Suggested fix:** Either reuse `InvitationContainer` here (consistent with `PatientDetailContainer`), or — if the "Page Privée" invite block must stay inline (no modal) — extract a `PrivatePageContainer.tsx` (feature root) that owns the `useGenerateInvitation` hook, and reduce `PrivatePageView` to a pure `components/PrivatePageView.tsx` driven by props.

---

### 1.2 `SessionHistoryView.tsx` — container-in-disguise + façade bypass
**File:** `src/features/patients/SessionHistoryView.tsx`

- Uses `useLiveQuery` to fetch data (a data-fetching hook), placed at the feature root without the `Container` suffix.
- Imports `getSessionsForPatient` from `'../sessions/services/localSessionService'` — a direct internal-path import into another feature, bypassing `features/sessions/index.ts`.

**Violates:** Rule 1, Rule 5 (naming), and Rule 2 (façade isolation — `features/sessions/index.ts` does not export `getSessionsForPatient`).

**Suggested fix:**
- Rename/extract to `SessionHistoryContainer.tsx` at `features/patients` root, with a pure `components/SessionHistoryList.tsx` for rendering.
- Export `getSessionsForPatient` (or a higher-level helper) from `features/sessions/index.ts` and import it from there.

---

### 1.3 `services/patientApiService.ts` — weak local-first justification
**File:** `src/features/patients/services/patientApiService.ts`

```ts
export async function fetchPatientsSummary(): Promise<PatientResponse[]> {
  return getPatients();
}
```

This is a 1:1 passthrough of `src/services/patientService.ts#getPatients` with no Dexie/local-persistence logic in the same file. CLAUDE.MD restricts feature-local `/services` to cases that "wrap the root `src/services/*` API clients **together with local persistence**" — here the persistence (`db.patients.bulkPut(...)`) happens in a *different* file (`core/offline/hooks/usePatientSync.ts`), and `fetchPatientsSummary` itself adds no value over calling `getPatients` directly.

**Suggested fix:** Either fold `fetchPatientsSummary` directly into `localPatientService.ts` as part of a single local-first sync function (API call + Dexie write together), or remove the wrapper and call `getPatients` from `src/services/patientService` directly at the call site.

---

### 1.4 `services/localPatientService.ts` — dead export
**File:** `src/features/patients/services/localPatientService.ts`

`upsertLocalPatient` is exported but has zero call sites anywhere in `src/`.

**Violates:** Rule 4 (no dead code).

**Suggested fix:** Delete `upsertLocalPatient`, or wire it into the patient-sync flow (see 1.3/2.2) if it was meant to replace the inline `db.patients.bulkPut(...)` call in `usePatientSync.ts`.

---

## 2. `core/offline/` — layering inversions (feature internals imported from shared infra)

`core/offline/` is documented as "Cross-cutting offline infrastructure ... shared across features" — i.e. it should sit *below* features, not depend on them. Two files break this:

### 2.1 `core/offline/syncEngine.ts`
```ts
import { syncSessionsBatch } from '../../features/sessions/services/sessionApiService';
```
Imports a concrete service from `features/sessions/services/` (internal path, not via `features/sessions/index.ts`).

**Violates:** Rule 2 (façade isolation) and creates a `core → feature` dependency, inverting the intended layering.

### 2.2 `core/offline/hooks/usePatientSync.ts`
```ts
import { fetchPatientsSummary } from '../../../features/patients/services/patientApiService';
```
Same issue: `core` reaches into `features/patients/services/` directly.

**Suggested fix (for both):** Move the sync orchestration into the owning feature (e.g. `features/sessions/services/syncSessions.ts`, `features/patients/services/syncPatients.ts`) and have `core/offline/syncEngine.ts` either (a) import these via each feature's `index.ts`, or (b) expose a registration API (`registerSyncTask(fn)`) that features call into from their own modules — keeping `core` free of feature-specific imports entirely.

---

## 3. `pages/patients/DashboardPage.tsx` — page is not a thin shell
**File:** `src/pages/patients/DashboardPage.tsx`

```tsx
const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
const [dashboardKey, setDashboardKey] = useState(0);

function handleJoinSuccess() {
  setIsJoinModalOpen(false);
  setDashboardKey(k => k + 1); // forces DashboardContainer to remount and re-fetch
}
```

This page owns local state, a handler with business logic (the remount-to-refetch trick), and conditionally renders a second container (`ConsumeInvitationContainer`) based on that state.

**Violates:** Rule 3 (pages must do nothing but import a container from `index.ts` and render it — no hooks/state/business logic).

**Suggested fix:** Introduce a top-level `PatientsDashboardContainer` (or extend `DashboardContainer`) in `features/patients` that owns `isJoinModalOpen`/`dashboardKey` and composes `ConsumeInvitationContainer` internally. `DashboardPage` should then reduce to:
```tsx
export function DashboardPage() {
  const navigate = useNavigate();
  return <PatientsDashboardContainer onSelectPatient={id => navigate(`/patients/${id}`)} />;
}
```
(`useNavigate`-based callbacks passed as props are consistent with the existing pattern in other pages, e.g. `PatientDetailPage`.)

---

## 4. `features/auth/index.ts` — non-container export from façade

```ts
export { AuthProvider, useAuth } from './hooks/useAuth';
export { LoginContainer } from './LoginContainer';
export { EnrollmentContainer } from './EnrollmentContainer';
export { ForgotPasswordContainer } from './ForgotPasswordContainer';
export { ResetPasswordContainer } from './ResetPasswordContainer';
export { ValidateCodeForm } from './components/ValidateCodeForm';
// exporter le hook useAuth ici
```

### 4.1 `ValidateCodeForm` exported from façade
`ValidateCodeForm` is a pure presentational component (no I/O), not a container and not a cross-feature "utility". It is consumed directly by `pages/auth/WelcomePage.tsx`, which wires its `onSubmit` to `navigate(...)` — i.e. the **page** performs container-style orchestration (composing two independent auth flows + owning navigation logic for one of them), which is borderline w.r.t. Rule 3.

**Suggested fix:** Add a small `ValidateCodeContainer` (or fold the validate-code flow into a `WelcomeContainer` in `features/auth`) that owns the `navigate(/enroll?code=...)` callback internally, and export only the container from `index.ts`. `WelcomePage` would then render `<WelcomeContainer />` (or two containers) without owning any logic itself.

### 4.2 Dead comment
```ts
// exporter le hook useAuth ici
```
`useAuth` is already exported on line 1 — this trailing comment is a stale leftover.

**Violates:** Rule 4 (no dead code from refactors).

**Suggested fix:** Delete the comment line.

---

## Summary Table

| # | Location | Issue | Rule(s) violated |
|---|----------|-------|-------------------|
| 1.1 | `features/patients/PrivatePageView.tsx` | Stateful/API-calling component at feature root, no `Container` suffix; duplicates `features/invitations` flow | 1, 5 |
| 1.2 | `features/patients/SessionHistoryView.tsx` | Data-fetching component without `Container` suffix; cross-feature internal import | 1, 5, 2 |
| 1.3 | `features/patients/services/patientApiService.ts` | Feature-local service with no real local-persistence logic | local-services justification |
| 1.4 | `features/patients/services/localPatientService.ts` | `upsertLocalPatient` unused | 4 |
| 2.1 | `core/offline/syncEngine.ts` | Imports `features/sessions/services/...` directly | 2, layering |
| 2.2 | `core/offline/hooks/usePatientSync.ts` | Imports `features/patients/services/...` directly | 2, layering |
| 3 | `pages/patients/DashboardPage.tsx` | `useState`/handler with business logic in a page | 3 |
| 4.1 | `features/auth/index.ts` | Presentational component (`ValidateCodeForm`) exported from façade; page does orchestration | 2/3 (façade scope) |
| 4.2 | `features/auth/index.ts` | Stale comment | 4 |

**Compliant reference implementations:** `features/collaborativeWall` (full Container/Presentational + façade), `features/sessions` (post-refactor), `features/invitations`, `features/auth` containers (`Login`, `Enrollment`, `ForgotPassword`, `ResetPassword`).
