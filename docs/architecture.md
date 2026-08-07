# Architecture

## Overview

DILGR8RSP is an npm-workspaces monorepo with two deployables:

- **`backend/`** — Express + TypeScript REST API, MySQL via Prisma, JWT auth.
- **`frontend/`** — React + TypeScript SPA (Vite), talks to the API over `fetch`.

Both follow **feature-first** organization: code is grouped by business capability (`auth`, `applicants`, `job-postings`, `applications`, and on the frontend `admin`) rather than by technical layer at the top level. Within each backend feature, Clean Architecture layering is still enforced (see below).

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

`frontend/src/shared/` holds cross-feature concerns: `api/apiClient.ts` (fetch wrapper + JWT header + `ApiError`), `auth/AuthContext.tsx` (session state), `components/` (`Layout`, `ProtectedRoute`, `ErrorBanner`).

### Role-based routing (frontend)

The `admin` feature (`frontend/src/features/admin/`) is a separate section of the app from the applicant-facing features, not just a different set of links on the same pages. `ProtectedRoute` (`shared/components/ProtectedRoute.tsx`) takes an optional `role` prop — `<ProtectedRoute role="ADMIN">` vs `<ProtectedRoute role="APPLICANT">` — and bounces a logged-in user of the wrong role to their own home (`/admin/jobs` or `/jobs`) rather than showing them the other side's pages. `Layout`'s nav renders a completely different link set depending on `user.role`: admins see only "Post a Job" and "Evaluate Applicants"; applicants see "Job Postings", "My Profile", "My Applications". There is no self-serve way to become an `ADMIN` — `/auth/register` always creates `APPLICANT` accounts (see [api.md](./api.md)) — so this split assumes admins are provisioned out-of-band (e.g. `prisma/seed.ts`).

Routing (`App.tsx`) uses `react-router-dom`; `ProtectedRoute` redirects unauthenticated users to `/login`, and `HomeRedirect` sends `/` to the right role-specific landing page.

## Database

See [database.md](./database.md) for the full schema. Summary: `User` (auth) 1:1 `Applicant` (profile) 1:N `WorkExperience`/`LdIntervention`/`Award`/`Document`; `Applicant` N:M `JobPosting` through `Application`.

## What's implemented vs. planned

The **Application phase** (Applicant Registration + job posting browsing + application submission) and a first-cut **Evaluation** capability (admin scores an application 0-100, records a qualified/not-qualified decision and remarks) are implemented. See [project-memory.md](./project-memory.md) for the full status against the [RSP domain spec](./rsp-domain-spec.md).
