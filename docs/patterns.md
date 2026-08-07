# Programming Patterns

Patterns actually in use in this codebase, documented as they're introduced (per `CLAUDE.md`'s documentation policy).

## Repository

**Purpose:** Isolate Prisma/SQL access behind a small, module-scoped class.

**Problem solved:** Without it, services and controllers would call `prisma.*` directly, coupling business logic to the ORM and making services hard to unit test.

**Implementation:** One `*.repository.ts` per module (`AuthRepository`, `ApplicantsRepository`, `DocumentsRepository`, `JobPostingsRepository`, `ApplicationsRepository`). Each takes a `PrismaClient` via its constructor and exposes intention-revealing methods (`findByEmail`, `addWorkExperience`, `findByApplicantAndPosting`) rather than a generic `find`/`save`.

**Advantages:** Services stay ORM-agnostic; repositories are trivially fakeable in tests; query shape (which relations to `include`) lives in one place per entity.

**Disadvantages:** One more file per module; for very simple CRUD it can feel like ceremony.

**Example usage:** `backend/src/modules/applicants/applicants.repository.ts`, consumed by `applicants.service.ts`.

**Related files:** every `*.repository.ts` under `backend/src/modules/`.

**Possible alternatives:** Active Record (Prisma model methods called directly from services) — rejected because it couples business logic to the ORM's API surface.

---

## Service Layer

**Purpose:** Hold business rules and orchestration, independent of HTTP and persistence details.

**Problem solved:** Keeps controllers thin (HTTP-shape translation only) and keeps validation-independent business rules (e.g. "promotional applications require an IPCR and Designation Order upload") in one testable place instead of scattered across route handlers.

**Implementation:** One `*.service.ts` per module, taking its repository (and occasionally other repositories, e.g. `ApplicationsService` also needs `ApplicantsRepository`, `JobPostingsRepository`, `DocumentsRepository`) via constructor injection. Throws typed `AppError` subclasses on business-rule violations.

**Advantages:** Business rules are unit-testable without an HTTP server or a database; controllers stay uniform and boring.

**Disadvantages:** For single-repository CRUD modules the service can look like a thin pass-through.

**Example usage:** `backend/src/modules/applications/applications.service.ts` — enforces the RSP domain spec's application-window and document-completeness rules.

**Related files:** every `*.service.ts` under `backend/src/modules/`.

**Possible alternatives:** Fat controllers (rejected — untestable, business rules trapped behind Express types) or a CQRS command/query bus (rejected as over-engineered for this module count).

---

## DTO (Data Transfer Object)

**Purpose:** Define the exact shape of data crossing the HTTP boundary, decoupled from Prisma's generated types.

**Problem solved:** Prevents leaking internal DB columns into API responses/requests and gives one place (`*.dto.ts`) that is simultaneously the validation schema and the TypeScript type.

**Implementation:** [Zod](https://zod.dev) schemas per module (`createApplicantProfileSchema`, `createJobPostingSchema`, ...), each paired with `z.infer<typeof schema>` for the TS type. The schema is both the runtime validator (via `shared/validation/validate.ts`) and the compile-time contract — no risk of the two drifting apart.

**Advantages:** Single source of truth for shape + validation; safe coercion (e.g. `z.coerce.date()` for form date strings); rich error messages.

**Disadvantages:** Zod schemas can get verbose for large objects; requires discipline to keep frontend `types.ts` in sync (not currently auto-generated — see project-memory.md's technical debt).

**Example usage:** `backend/src/modules/applicants/applicants.dto.ts`.

**Related files:** every `*.dto.ts` under `backend/src/modules/`.

**Possible alternatives:** class-validator + decorators (heavier, needs `reflect-metadata`); hand-written type guards (more boilerplate, no coercion).

---

## Dependency Injection (manual, via composition root)

**Purpose:** Let high-level modules (services, controllers) depend on abstractions/constructor parameters rather than constructing their own collaborators.

**Problem solved:** Swapping an implementation (e.g. a fake repository in a unit test) requires touching only the call site, not the class itself.

**Implementation:** No DI framework/container library. `backend/src/container.ts` is a single "composition root" function that `new`s every repository, then every service (passing repositories in), then every controller (passing services in), and exports the wired controllers. `app.ts` imports only `container` and never calls `new SomeService()` itself.

**Advantages:** Zero extra dependency, fully readable (`Ctrl+click` shows exactly what's wired), no decorator/reflection magic.

**Disadvantages:** Doesn't scale gracefully much past this module count without the container file becoming unwieldy; no automatic circular-dependency detection.

**Example usage:** `backend/src/container.ts`.

**Related files:** every constructor in `backend/src/modules/**`.

**Possible alternatives:** `tsyringe`/`inversify` (decorator-based DI containers) — deferred until the manual approach actually becomes painful (see decisions.md).

---

## Centralized Error Handling

**Purpose:** One place translates every thrown error into an HTTP response, so controllers/services never format error JSON themselves.

**Problem solved:** Without it, every controller needs its own try/catch and status-code logic, which drifts inconsistent over time (different error shapes, forgotten catches producing raw 500s with stack traces).

**Implementation:** `backend/src/shared/errors/AppError.ts` defines a typed hierarchy (`ValidationError` 400, `UnauthorizedError` 401, `ForbiddenError` 403, `NotFoundError` 404, `ConflictError` 409), each carrying a machine-readable `code`. Controllers/services just `throw new NotFoundError(...)`. `shared/middleware/asyncHandler.ts` forwards rejected promises to Express's `next(err)`. `shared/middleware/errorHandler.ts`, mounted last in `app.ts`, is the only place matching on error type (including Prisma's `PrismaClientKnownRequestError` and Multer's `MulterError`) and writing the response.

**Advantages:** Controllers read as straight-line business logic with no error-formatting noise; consistent `{ error: { code, message, details } }` shape across the whole API, which the frontend's `ApiError` class relies on.

**Disadvantages:** Errors that aren't `AppError` (or the two special-cased library errors) collapse to a generic 500 — acceptable since those represent genuine bugs that should be logged and fixed, not surfaced with detail to the client.

**Example usage:** `backend/src/shared/middleware/errorHandler.ts`, thrown from e.g. `applications.service.ts`.

**Related files:** `shared/errors/AppError.ts`, `shared/middleware/errorHandler.ts`, `shared/middleware/asyncHandler.ts`, `frontend/src/shared/api/apiClient.ts` (the consuming side).

**Possible alternatives:** Per-route try/catch (rejected — the inconsistency this pattern exists to prevent).

---

## Validation Layer (middleware)

**Purpose:** Reject malformed requests before they reach business logic.

**Problem solved:** Keeps `req.body`/`params`/`query` shape-checking out of controllers and guarantees services only ever see already-validated, already-typed input.

**Implementation:** `shared/validation/validate.ts` exports `validate({ body?, params?, query? })`, an Express middleware factory that runs the given Zod schema(s), throws `ValidationError` (caught by the centralized error handler) on failure, and otherwise replaces `req.body`/`params`/`query` with the parsed (and coerced) data.

**Advantages:** Declarative — the schema is visible right in the route definition (`*.routes.ts`); coercion (e.g. string→Date, string→number) happens once, consistently.

**Disadvantages:** File uploads (`multipart/form-data`) can't go through this middleware since Multer needs to run first to populate `req.body`/`req.file`; `documents.controller.ts` validates those fields inline instead (documented deviation, not an oversight).

**Example usage:** `backend/src/modules/applicants/applicants.routes.ts`.

**Related files:** `shared/validation/validate.ts`, every `*.routes.ts`.

**Possible alternatives:** Validating inside each controller (rejected — the exact duplication this pattern removes).
