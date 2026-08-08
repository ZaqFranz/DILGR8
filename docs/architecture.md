# Architecture

## Overview

DILGR8RSP is an npm-workspaces monorepo with two deployables:

- **`backend/`** — Express + TypeScript REST API, MySQL via Prisma, JWT auth.
- **`frontend/`** — React + TypeScript SPA (Vite), talks to the API over `fetch`.

Both follow **feature-first** organization: code is grouped by business capability (`auth`, `applicants`, `job-postings`, `applications`, `users`, `audit-logs`, and on the frontend `admin`) rather than by technical layer at the top level. Within each backend feature, Clean Architecture layering is still enforced (see below).

## Backend layering

Each backend module in `backend/src/modules/<name>/` is split into:

| Layer | File | Responsibility |
|---|---|---|
| Routes | `*.routes.ts` | Maps HTTP verb+path to a controller method; wires in `authenticate`/`requireRole`/`validate` middleware. |
| Controller | `*.controller.ts` | Translates `Request`/`Response` to/from plain DTOs; no business logic. |
| Service | `*.service.ts` | Business rules and orchestration (e.g. "promotional applications need IPCR + Designation Order uploaded"). Throws `AppError` subclasses on failure. |
| Repository | `*.repository.ts` | Only place that talks to Prisma for that module. Returns Prisma types or thin wrappers. |
| DTO | `*.dto.ts` | Zod schemas (source of truth for validation) + inferred TypeScript types. |

Cross-cutting concerns live in `backend/src/shared/`:

- `errors/AppError.ts` — typed error hierarchy (`ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`), each carrying an HTTP status + machine-readable `code`.
- `middleware/errorHandler.ts` — the **only** place that turns a thrown error into an HTTP response (see [patterns.md](./patterns.md#centralized-error-handling)).
- `middleware/authenticate.ts` — JWT verification (`authenticate`) and role gating (`requireRole`).
- `middleware/asyncHandler.ts` — wraps async route handlers so rejected promises reach `errorHandler`.
- `validation/validate.ts` — Express middleware that runs a Zod schema against `body`/`params`/`query` before the controller runs.
- `logging/logger.ts` — Pino logger (pretty-printed in development).
- `db/prismaClient.ts` — single shared `PrismaClient` instance.

### Composition root

`backend/src/container.ts` is the single place that constructs repositories → services → controllers and wires their dependencies together (manual constructor injection — see [patterns.md](./patterns.md#dependency-injection)). `app.ts` only imports `container` and mounts routers; it never constructs a service or repository itself. This keeps every class unit-testable by constructing it directly with fakes, without a DI framework.

### Request flow

```
HTTP request
  → Express router (modules/<x>/<x>.routes.ts)
  → middleware: authenticate (JWT) → validate (Zod) → asyncHandler
  → controller (modules/<x>/<x>.controller.ts)
  → service (modules/<x>/<x>.service.ts)          [business rules, throws AppError]
  → repository (modules/<x>/<x>.repository.ts)    [Prisma]
  ← response JSON
  (errors thrown anywhere above are caught once by shared/middleware/errorHandler.ts)
```

## Frontend layering

`frontend/src/features/<name>/` mirrors the backend's module boundaries:

- `api/` — thin wrappers around `shared/api/apiClient.ts` (one function per backend endpoint).
- `types.ts` — TypeScript types matching the backend's DTO shapes.
- `components/` — presentational + form components scoped to that feature.
- `pages/` — route-level components composed from the above.

`frontend/src/shared/` holds cross-feature concerns: `api/apiClient.ts` (fetch wrapper + JWT header + `ApiError`), `auth/AuthContext.tsx` (session state), `components/` (`Layout`, `ProtectedRoute`, `ErrorBanner`, `Modal`, `ConfirmDialog`, `ToastProvider`, `FieldError`, `LoadingBlock`, `Spinner`).

`Modal` (`shared/components/Modal.tsx`) is the generic dialog primitive - Escape/click-outside-to-close, rendered via `createPortal` so it always sits above page content. `ConfirmDialog` wraps it for destructive-action confirmations (used everywhere a delete happens). The admin CRUD tables (`JobManagementPage`, `UsersManagementPage`) wrap it the same way for create/edit: the page renders a table only (no inline form) with an "Add X" button in a `.page-header` row; the button and each row's "Edit" open the same `Modal`-hosted form, switching title/submit label based on whether an id is being edited. The form's submit button lives in the modal's `footer` and targets the form via the HTML `form="…"` attribute rather than being nested inside it, since `Modal`'s footer is a sibling of `modal-body`, not a child of the form.

### Role-based routing (frontend)

The `admin` feature (`frontend/src/features/admin/`) is a separate section of the app from the applicant-facing features, not just a different set of links on the same pages. `ProtectedRoute` (`shared/components/ProtectedRoute.tsx`) takes an optional `role` prop — `<ProtectedRoute role="ADMIN">` vs `<ProtectedRoute role="APPLICANT">` — and bounces a logged-in user of the wrong role to their own home (`/admin/jobs` or `/jobs`) rather than showing them the other side's pages. There is no self-serve way to become an `ADMIN` via `/auth/register` (always creates `APPLICANT`), but an existing admin can provision another admin account through Users Management (`POST /api/users` — see [api.md](./api.md)), or one can be seeded via `prisma/seed.ts`.

### Registration gating (frontend)

All applicant data (account, demographic profile, work experience, L&D, awards, documents) is collected in one continuous flow, not split into "sign up" then "fill in your info after logging in." `RegistrationPage` (`frontend/src/features/applicant-registration/pages/RegistrationPage.tsx`) owns the entire flow at `/register` — it renders the account-creation form for unauthenticated visitors and, immediately after `register()` succeeds, continues in place through the same steps the old post-login wizard used, with no route change or "you're now logged in" handoff in between.

`AuthContext` tracks `registrationComplete: boolean | null` for the current session (always `true` for `ADMIN`; fetched from `GET /api/applicants/me` for `APPLICANT` right after login/register and on session restore). `ProtectedRoute` and `HomeRedirect` both redirect an applicant with `registrationComplete === false` to `/register`, regardless of which page they try to reach directly — so browsing job postings or submitting applications is unreachable until `POST /api/applicants/me/complete-registration` has been called. Completing registration is what flips `registrationComplete` to `true` (via `refreshRegistrationStatus()`); `/register` remains reachable afterward too, so applicants can still revisit it to edit their profile (Layout's "My Profile" link), it just no longer blocks anything once complete.

Admin and applicant sections also look structurally different, not just role-gated: `Layout` (`shared/components/Layout.tsx`) renders the applicant-facing top nav ("Job Postings", "My Profile", "My Applications") only for `role === "APPLICANT"`, and stays minimal (brand + identity + logout) for admins. Every `/admin/*` page instead wraps its content in `AdminShell` (`features/admin/components/AdminShell.tsx`), a left sidebar with links to the four admin sections (Job Management, Users Management, Evaluate Applicants, History of Logs), active-link-highlighted via `useLocation()`. `Layout` detects `pathname.startsWith("/admin")` and swaps `.app-main` for the unconstrained `.app-main--full` so the sidebar can span full width instead of being squeezed into the applicant pages' centered 960px column.

Routing (`App.tsx`) uses `react-router-dom`; `ProtectedRoute` redirects unauthenticated users to `/login`, and `HomeRedirect` sends `/` to the right role-specific landing page.

## Database

See [database.md](./database.md) for the full schema. Summary: `User` (auth) 1:1 `Applicant` (profile) 1:N `WorkExperience`/`LdIntervention`/`Award`/`Document`; `Applicant` N:M `JobPosting` through `Application`; `User` also 1:N `JobPosting` (creator), `Application` (evaluator), and `AuditLog` (actor) — all three nullable/`SetNull` so deleting a user never blocks on, or cascades into, those records.

## Audit logging (cross-cutting)

`AuditLogsRepository` (`backend/src/modules/audit-logs/audit-logs.repository.ts`) is injected into `UsersService`, `JobPostingsService`, and `ApplicationsService` the same way `DocumentsRepository` is injected into `ApplicationsService` — a repository consumed directly by another module's service, not wrapped in its own service layer for the write side. Each service calls `.record()` after a successful write (user/job-posting create-update-delete, application evaluate) to append one `AuditLog` row. The read side (`GET /api/audit-logs`) goes through a thin `AuditLogsService` for query shaping. See [patterns.md](./patterns.md) and [decisions.md](./decisions.md) for why this is deliberately append-only with no update/delete path.

## What's implemented vs. planned

The **Application phase** (Applicant Registration + job posting browsing + application submission), a first-cut **Evaluation** capability (admin scores an application 0-100, records a qualified/not-qualified decision and remarks), and an **admin panel** (sidebar-navigated Job Management, Users Management, Evaluate Applicants, History of Logs — all full CRUD except the intentionally read-only logs) are implemented. See [project-memory.md](./project-memory.md) for the full status against the [RSP domain spec](./rsp-domain-spec.md).
