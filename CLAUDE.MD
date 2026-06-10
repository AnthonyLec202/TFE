# Project Architecture & AI Coding Guidelines

This document defines the strict architectural patterns and coding standards for this project. You must adhere to these rules for all code generation, refactoring, and architectural suggestions.

## 1. General Coding Standards
- **Naming Convention:** All code identifiers (variables, properties, methods, functions, classes, interfaces, types) MUST be explicitly named in English.
- **Paradigm:** Adhere strictly to Object-Oriented Programming (OOP) principles on the backend and functional/compositional patterns on the frontend.
- **Tone:** Provide direct, highly technical explanations. Avoid metaphors, analogies, or conversational filler. Use precise terminology (Dependency Injection, Polymorphism, Encapsulation, HOC, Custom Hooks, etc.).

---

## 2. Frontend Architecture: Feature-Driven (Container / Presentational)
The frontend follows a strict Feature-Driven architecture combined with a mandatory Container/Presentational split. Code is co-located by domain logic rather than by technical type.

### Folder Structure
- `src/features/{featureName}/`: Contains all code specific to a single domain feature.
  - `*Container.tsx` (feature root): Containers. Own data fetching (custom hooks, `useLiveQuery`, etc.), local state, side effects (`useEffect`), and mutation/API calls. Compose presentational components and/or other sub-containers.
    - One **top-level container** per page-level entry point (e.g. `SessionsDashboardContainer`, `SessionWorkspaceContainer`).
    - **Sub-containers** (e.g. `CreateSessionContainer`, `PostCardContainer`, `CommentItemContainer`) also live at the feature root, but are only composed internally by a top-level container — they are implementation details, not public entry points.
  - `/components`: Pure presentational components. Receive all data and callbacks via props, contain no `services/` or API imports, and are reusable/testable in isolation. Exception: small self-contained "smart widgets" (e.g. a typeahead/autocomplete that owns its own read-side search) may perform their own read queries — document this exception inline if used.
  - `/hooks`: Custom hooks encapsulating feature-specific state or side effects shared across containers.
  - `/services`: Feature-local data access. Required only when the feature has local-first/offline storage — these wrap the root `src/services/*` API clients together with local persistence (e.g. Dexie). Features without offline support call `src/services/*` directly from their containers.
  - `/types`: TypeScript types/ambient declarations (`.d.ts`) used **only** by this feature.
  - `/utils`: Pure helper functions specific to this feature (formatting, business-rule predicates) — no React, no I/O.
  - `index.ts`: The feature's public façade. Exports **only** the top-level container(s) mounted by `pages/`, plus any utility explicitly needed by another feature. Sub-containers, hooks, utils, and presentational components are NOT exported unless genuinely consumed outside the feature.
- `src/components/ui/`: Only highly reusable, generic, dumb components (Button, Card, Input).
- `src/components/layout/`: Application shell (Navbar, MainLayout).
- `src/services/`: Shared raw API clients (`apiClient`, `*Service.ts`) — thin HTTP wrappers with no business logic, used by any feature.
- `src/core/offline/`: Cross-cutting offline infrastructure (local database, sync engine, network status hooks) shared across features.
- `src/types/`: DTOs/types shared across two or more features only. Feature-specific types belong in `features/{featureName}/types/`.

### Frontend Rules
1. **Container/Presentational split is mandatory.** Containers (`*Container.tsx`, feature root) handle data and side effects; presentational components (`components/*.tsx`) are props-driven only.
2. **Isolation via `index.ts`.** A feature — and `pages/` — may only import from another feature's `index.ts` (its public façade). Never import from another feature's internal paths (`features/x/components/...`, `features/x/services/...`, `features/x/SomeContainer`, etc.). If sharing is required, export it from the target feature's `index.ts`.
3. **Pages are thin shells.** A page component does nothing but import a Container from a feature's `index.ts` and render it — no hooks, state, or business logic in `pages/`.
4. **No dead code from refactors.** When moving or renaming a file, delete the old file entirely. Never leave "Removed. Migrated to..." stub files or unused re-export shims behind.
5. **Naming convention.** Containers always end with the `Container` suffix; presentational components never do.

---

## 3. Backend Architecture: N-Tier / Layered Pattern
The backend is structured around a strict separation of concerns utilizing the Repository Pattern and Dependency Injection (DI).

### Layer Definitions & Responsibilities
- **Controllers (`/Controllers`)**: 
  - Entry points for HTTP requests.
  - Sole responsibility: Route handling, payload validation, and returning proper HTTP status codes.
  - Must NOT contain business logic. They delegate execution to Services.
- **Data Transfer Objects (`/DTOs`)**:
  - Plain objects defining the exact shape of data entering (Request) or leaving (Response) the API.
  - Used to decouple the database schema from the API contract.
- **Services (`/Services`)**:
  - The core of the application containing all business rules and logic.
  - Orchestrates calls to one or multiple Repositories.
  - Maps Models to DTOs before returning data to the Controller.
- **Interfaces (`/Interfaces`)**:
  - Contracts defining the methods for Services and Repositories.
  - Essential for Dependency Injection and creating mockable, testable code.
- **Repositories (`/Repositories`)**:
  - The single source of truth for data access.
  - Directly interacts with the database (e.g., via EF Core `DbContext` or direct queries).
  - Must NOT contain business logic; only CRUD operations and complex queries returning `Models`.
- **Models / Entities (`/Models`)**:
  - POCOs (Plain Old CLR Objects) representing database tables/schema.
  - Managed by the ORM. Should not contain application logic.
- **Data (`/Data`)**:
  - Database context definitions, migrations, and seeding scripts.

### Backend Rules
1. **Dependency Injection:** Layers must only communicate through injected interfaces (e.g., Controller -> `IService`, Service -> `IRepository`).
2. **DTO Mapping:** Never return a database `Model` directly from a Controller. Always map it to a `DTO` within the Service layer to prevent over-posting and data leaks.
3. **Fat Services, Skinny Controllers:** Controllers should ideally be 1-3 lines of code per endpoint.

## 4. Instruction for Claude
When asked to implement a new feature:
1. Generate the required DTOs and Interfaces first.
2. Implement the Repository logic.
3. Implement the Service logic integrating the business rules.
4. Expose the endpoint via the Controller.
5. Create the corresponding Feature folder on the frontend with its API client, hooks, and components.