# Architecture

## Overview

DILGR8RSP is an npm-workspaces monorepo with two deployables:

- **`backend/`** — Express + TypeScript REST API, MySQL via Prisma, JWT auth.
- **`frontend/`** — React + TypeScript SPA (Vite), talks to the API over `fetch`.

Both follow **feature-first** organization: code is grouped by business capability (`auth`, `applicants`, `job-postings`, `applications`, `users`, `audit-logs`, `dashboard`, `evaluation-criteria`, `panel-assignments`, `panel-evaluations`, and on the frontend `admin` plus `panel`) rather than by technical layer at the top level. Within each backend feature, Clean Architecture layering is still enforced (see below).

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

The `admin` feature (`frontend/src/features/admin/`) is a separate section of the app from the applicant-facing features, not just a different set of links on the same pages. `ProtectedRoute` (`shared/components/ProtectedRoute.tsx`) takes an optional `role` prop, `<ProtectedRoute role="ADMIN">` vs `<ProtectedRoute role="APPLICANT">` vs `<ProtectedRoute role="PANEL">` (the prop type is `AppRole | AppRole[]`, checked via array-membership, so a route could allow more than one role if a future page needs it) — and bounces a logged-in user of the wrong role to their own home (`HOME_BY_ROLE`: `/admin/dashboard`, `/jobs`, or `/panel/interviews`) rather than showing them another role's pages. There is no self-serve way to become `ADMIN` or `PANEL` via `/auth/register` (always creates `APPLICANT`), but an existing admin can provision either through Users Management (`POST /api/users` — see [api.md](./api.md)), or one can be seeded via `prisma/seed.ts`.

### Registration gating (frontend)

All applicant data (account, demographic profile, work experience, L&D, awards, documents) is collected in one continuous flow, not split into "sign up" then "fill in your info after logging in." `RegistrationPage` (`frontend/src/features/applicant-registration/pages/RegistrationPage.tsx`) owns the entire flow at `/register` — it renders the account-creation form for unauthenticated visitors and, immediately after `register()` succeeds, continues in place through the same steps the old post-login wizard used, with no route change or "you're now logged in" handoff in between.

`AuthContext` tracks `registrationComplete: boolean | null` for the current session (always `true` for `ADMIN`; fetched from `GET /api/applicants/me` for `APPLICANT` right after login/register and on session restore). `ProtectedRoute` and `HomeRedirect` both redirect an applicant with `registrationComplete === false` to `/register`, regardless of which page they try to reach directly — so browsing job postings or submitting applications is unreachable until `POST /api/applicants/me/complete-registration` has been called. Completing registration is what flips `registrationComplete` to `true` (via `refreshRegistrationStatus()`); `/register` remains reachable afterward too, so applicants can still revisit it to edit their profile (Layout's "My Profile" link), it just no longer blocks anything once complete.

Admin and applicant sections also look structurally different, not just role-gated: `Layout` (`shared/components/Layout.tsx`) renders the applicant-facing top nav ("Job Postings", "My Profile", "My Applications") only for `role === "APPLICANT"`, a single "My Interviews" link for `role === "PANEL"`, and stays minimal (brand + identity + logout) for admins. Every `/admin/*` page instead wraps its content in `AdminShell` (`features/admin/components/AdminShell.tsx`), a left sidebar with links to the admin sections (Dashboard, Job Management, Users Management, Evaluate Applicants, Interview Panel, Evaluation Criteria, History of Logs), active-link-highlighted via `useLocation()`. The `panel` role doesn't get an equivalent sidebar shell — it has exactly one page (`MyInterviewsPage`, `/panel/interviews`), so it renders as a plain page under `Layout` the same way applicant pages do; a `PanelShell` would be pure ceremony at one page. `Layout` detects `pathname.startsWith("/admin")` and swaps `.app-main` for the unconstrained `.app-main--full` so the sidebar can span full width instead of being squeezed into the applicant pages' centered 960px column.

The login page and the registration flow's first (unauthenticated "create an account") step get their own full-bleed branded treatment via a `.auth-page` CSS class, rather than a `Layout`/route-level class swap like the admin sidebar above - it's scoped inside `LoginPage`/`RegistrationPage` themselves (the rest of the registration wizard, once authenticated, stays in the normal centered column). `.auth-page` breaks out of `.app-main`'s max-width via the `left: 50%; margin-left: -50vw;` CSS trick, which - unlike `.app-main--full` - works from inside a normally-constrained parent with no cooperation needed from `Layout`. `html`/`body` carry `overflow-x: hidden` specifically to absorb the few px of horizontal overflow that trick introduces (`100vw` includes the scrollbar's own width, `100%` doesn't) - `.table-wrap`'s own `overflow-x: auto` is an independent scroll region and is unaffected. `.app-main:has(.auth-page)` (descendant, not direct-child - `RegistrationPage` nests `.auth-page` one level inside its own wrapper `<div>`, `LoginPage` renders it as the top-level element, so a `>` combinator would only catch one of the two) zeroes `.app-main`'s vertical padding specifically on these pages so `.auth-page`'s `min-height: 100vh` fills the viewport with no grey gap top or bottom; an earlier attempt used negative margins to cancel that padding instead, but the negative margins fed back into `.app-main`'s own flex-computed height and overshot the viewport, so `:has()` replaced it. The real DILG seal (`frontend/public/dilg-logo.webp`, user-supplied - not fabricated) appears crisp and small atop the login/account card, and twice more, large and blurred, in opposite corners as background texture - positioned off-center since a single centered copy would just sit directly behind the card and be invisible (an intermediate version tiled it across the whole panel instead, which read as busy/repetitive and was reverted to two big copies).

`Layout` also drops the top nav bar entirely on these same two screens (`hideHeader` in `Layout.tsx`, keyed on `pathname === "/login"` or `pathname === "/register" && !isAuthenticated`) for a fully immersive full-page look - the nav there would only ever offer "Log in"/"Register" links pointing at wherever the visitor already is. Since that removes the only way to get from one to the other, `LoginPage`/`RegistrationPage` each carry their own small `.auth-switch` cross-link ("Don't have an account? Register" / "Already have an account? Log in") inside the card itself. `.auth-form` also needed an explicit `width: 100%` (not just `max-width: 400px`) - as a flex item of `.auth-page` (a flex container) it otherwise shrinks to fit its own content rather than filling up to the max-width, which visibly under-sized the login card (shorter copy) relative to the registration card (longer copy) even though both shared the same CSS rule.

Routing (`App.tsx`) uses `react-router-dom`; `ProtectedRoute` redirects unauthenticated users to `/login`, and `HomeRedirect` sends `/` to the right role-specific landing page.

## Database

See [database.md](./database.md) for the full schema. Summary: `User` (auth) 1:1 `Applicant` (profile) 1:N `WorkExperience`/`LdIntervention`/`Award`/`Document`; `Applicant` N:M `JobPosting` through `Application`; `User` also 1:N `JobPosting` (creator), `Application` (evaluator), and `AuditLog` (actor) — all three nullable/`SetNull` so deleting a user never blocks on, or cascades into, those records.

## Dashboard (cross-cutting)

`DashboardRepository` (`backend/src/modules/dashboard/dashboard.repository.ts`) queries `User`/`Applicant`/`JobPosting`/`Application` directly via Prisma `groupBy`/`count` rather than going through each feature's own repository - it's a read-only reporting concern, not a write path any other service depends on, the same reasoning that keeps `AuditLogsRepository` a direct Prisma consumer. `DashboardService` additionally takes `AuditLogsRepository` as a second constructor dependency purely to reuse its existing `findMany` for the "recent activity" feed, rather than duplicating that query. The frontend (`DashboardPage`, `/admin/dashboard`, now the admin role's landing page in place of `/admin/jobs`) renders the single `GET /api/dashboard/summary` response as a stat-tile row, two small horizontal-bar charts (applications by status, top job postings by application count - built as plain `div`s, no charting library), and a recent-activity table reusing `AuditLogsPage`'s row shape. Applications-by-status bar colors reuse the same status hues as the `.badge` classes elsewhere in the app (success/warning/info/danger/muted) rather than a separate chart palette, so a status reads the same color whether it's a badge or a bar.

## Interview panel & CompAss tabulation

Three modules implement the real multi-evaluator Evaluation phase the spec describes, replacing the single-admin-score stand-in flagged as deferred scope in [decisions.md](./decisions.md)'s 2026-08-07 entry:

- **`evaluation-criteria`** — admin-editable interview rubric (`EvaluationCriterion`: name + `maxScore`, `maxScore` doubling as the criterion's weight). `PATCH .../isActive` retires a criterion instead of deleting it once it has scores (`DELETE` is 409-blocked in that case, the same guard shape `JobPostingsService.delete` uses for a posting with applications).
- **`panel-assignments`** — pure M:N metadata (`PanelAssignment`: `jobPostingId` × `panelUserId`) admin manages per posting. No cascading write side-effects; deleting a posting or a panel user just drops the row.
- **`panel-evaluations`** — the scoring itself. `PanelEvaluation` (one row per panelist per application, unique on `[applicationId, panelUserId]`) has child `PanelScore` rows (one per criterion); `PanelEvaluationsRepository.upsertEvaluation` wraps the upsert-header + delete-and-recreate-children in a `$transaction`. The service cross-checks against `PanelAssignmentsRepository` (is this panelist assigned to this application's posting?) and `EvaluationCriteriaRepository` (every active criterion scored, no score over its `maxScore`) — both injected directly, the same cross-module-repository-reuse pattern `ApplicationsService` already uses for `DocumentsRepository`/`JobPostingsRepository`.

**Status flow**: `Application.status` runs `SUBMITTED` → `UNDER_SIFTING` (automatic, the instant an application is created) → `QUALIFIED`/`NOT_QUALIFIED` (the Sifting phase's pass/fail call, `PATCH /applications/:id/sift`, gated to `UNDER_SIFTING`) → PQE score recorded on a `QUALIFIED` application via `POST /applications/import-exam-scores` (an Excel import matched by name, doesn't move `status`) → `FOR_INTERVIEW` (`PATCH /applications/:id/schedule-interview`, gated to `status === QUALIFIED` **and** a recorded `examinationScore`). This reworks what was originally a single free-standing `PATCH /applications/:id/evaluate` action (any status → `QUALIFIED`/`NOT_QUALIFIED`, no gating) into the actual Sifting/PQE/Interview sequence the domain spec describes - see [decisions.md](./decisions.md)'s 2026-08-08 "Sifting/PQE/Interview pipeline" entry. Panel-scoring completeness still isn't a precondition anywhere in this chain (an admin can schedule an interview before every assigned panelist has scored a *previous* application) - `EvaluateApplicantsPage` fetches `GET /panel-evaluations/tabulation/:jobPostingId` alongside the applications list and shows a `panelistsSubmitted < panelistsAssigned` warning inside `EvaluationRow`'s expanded panel-score summary.

**Tabulation (CompAss)**: `PanelEvaluationsService.tabulation()` computes the ranked matrix in application code rather than SQL — sums each `PanelEvaluation`'s `PanelScore`s, averages across panelists who've submitted per application, sorts descending, and assigns rank (unscored applications rank `null`, sort last). `EvaluateApplicantsPage` renders this as two extra table columns ("Panel Avg", "Rank") rather than a separate matrix view, so the tabulation always sits next to the finalize action it's meant to inform.

**Frontend role addition**: `PANEL` is a full third `Role`, not an admin sub-type — `Users Management`'s existing role `<select>` just gained a "Panel" option, so provisioning a panel account reuses all of Users Management's CRUD rather than needing its own page. A panelist's own view (`frontend/src/features/panel/pages/MyInterviewsPage.tsx`, `/panel/interviews`) lists `GET /panel-evaluations/my-queue` — applications `FOR_INTERVIEW` across every posting they're assigned to — each expandable (mirroring `EvaluationRow`'s expand/collapse pattern) into a per-criterion score form.

**Out of scope** (see [decisions.md](./decisions.md)): letter/notice generation and the spec's 1:5 auto-shortlisting ratio, both listed under the domain spec's "Tabulation" section but not part of this feature — they're a separate notifications/documents concern.

## Audit logging (cross-cutting)

`AuditLogsRepository` (`backend/src/modules/audit-logs/audit-logs.repository.ts`) is injected into `UsersService`, `JobPostingsService`, `ApplicationsService`, `EvaluationCriteriaService`, `PanelAssignmentsService`, and `PanelEvaluationsService` the same way `DocumentsRepository` is injected into `ApplicationsService` — a repository consumed directly by another module's service, not wrapped in its own service layer for the write side. Each service calls `.record()` after a successful write (user/job-posting create-update-delete, application sift/exam-score-import/schedule-interview, criterion create-update-delete, panel assign/unassign, panel evaluation submit) to append one `AuditLog` row. The read side (`GET /api/audit-logs`) goes through a thin `AuditLogsService` for query shaping. See [patterns.md](./patterns.md) and [decisions.md](./decisions.md) for why this is deliberately append-only with no update/delete path.

## What's implemented vs. planned

The **Application phase** (Applicant Registration + job posting browsing + application submission), **Sifting** (automatic `UNDER_SIFTING` on submit, admin pass/fail call against the qualification standards), **PQE score recording** (Excel import matched by applicant name - the exam itself is conducted outside the system, per the domain spec), a real multi-evaluator **Evaluation** capability (admin schedules a Qualified-with-PQE-score application for interview, an assigned interview board scores it against an admin-editable rubric, admin sees the ranked CompAss matrix), and an **admin panel** (sidebar-navigated Dashboard, Job Management, Users Management, Evaluate Applicants, Interview Panel, Evaluation Criteria, History of Logs — all full CRUD except the intentionally read-only logs) are implemented. Not implemented: letter/notice generation, the spec's 1:5 auto-shortlisting ratio, Deliberation's PDC-approval step, Compliance to Requirements, Onboarding, L&D, and PDC/Permit-to-Study. See [project-memory.md](./project-memory.md) for the full status against the [RSP domain spec](./rsp-domain-spec.md).
