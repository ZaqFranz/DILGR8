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

---

## Role-Based Access Control (route guard)

**Purpose:** Restrict entire routes/pages to one or more specific roles (`ADMIN` / `APPLICANT` / `PANEL`), enforced symmetrically on both backend and frontend.

**Problem solved:** "Admin can only post jobs and evaluate applicants, panel members can only score their assigned interviews" needs to hold even if someone hits another role's URL directly — not just hide a nav link.

**Implementation:** Backend: `shared/middleware/authenticate.ts` exports `requireRole(...roles)`, a variadic Express middleware placed after `authenticate` on role-gated routes (e.g. `POST /api/job-postings` → `requireRole("ADMIN")`, `GET /api/categories` → `requireRole("ADMIN", "PANEL")`) — throws `ForbiddenError` (403) if `req.user.role` isn't in the allowed list. Frontend: `shared/components/ProtectedRoute.tsx` takes an optional `role` prop, `AppRole | AppRole[]`; a logged-in user of the wrong role is redirected to their own role's home (`HOME_BY_ROLE`) instead of the requested page. `Layout`'s nav also renders a different link set per role, so the mismatch is rarely user-visible in practice — the guard is the enforcement, the nav is just not offering the other roles' links.

A route can also be shared by two roles with *different* data-scoping within the same handler, rather than an all-or-nothing gate: `documents.service.ts`'s `listForApplicant`/`getFileForViewer` (see [decisions.md](./decisions.md)'s 2026-08-11 "Panel document access" entry) take a `viewer: { id: string; role: Role }` param — `requireRole("ADMIN", "PANEL")` gets both roles past the route, and the service itself then filters the document list and enforces a per-applicant assignment check only when `viewer.role === "PANEL"`, leaving `ADMIN` unfiltered and unchecked. This keeps the coarse route-level gate and the finer per-role data policy in the same layer (the service, next to the rule it's enforcing) rather than duplicating the route into `/admin/...`/`/panel/...` variants.

**Advantages:** Same authorization decision (which role can do what) isn't duplicated in ad-hoc if-checks scattered through handlers/components; backend guard is the actual security boundary, frontend guard is UX (prevents a confusing 403 after a full page navigation); both backend and frontend accept multiple roles natively (variadic / array), so a route shared by two roles doesn't need a workaround.

**Disadvantages:** Two places to keep in sync (backend route + frontend route) when a new role-gated capability is added.

**Example usage:** `backend/src/modules/applications/applications.routes.ts` (`requireRole("ADMIN")` on the admin endpoints), `backend/src/modules/categories/categories.routes.ts` (`requireRole("ADMIN", "PANEL")` on the read endpoint - both roles need it, only `ADMIN` can write), `frontend/src/App.tsx` (`<ProtectedRoute role="ADMIN">` / `role="APPLICANT"` / `role="PANEL"` per route group).

**Related files:** `shared/middleware/authenticate.ts`, `frontend/src/shared/components/ProtectedRoute.tsx`, `frontend/src/shared/components/Layout.tsx`, `backend/src/modules/applicants/documents/documents.service.ts` (viewer-scoped data filtering variant), `backend/src/modules/panel-assignments/panel-assignments.repository.ts` (`isPanelUserAssignedToApplicant`, the check that variant relies on).

**Possible alternatives:** A dedicated permissions/claims system (rejected as over-engineered for two roles); hiding pages via CSS/conditional render without a real redirect guard (rejected — doesn't actually block direct navigation).

---

## Audit Trail (append-only log via injected repository)

**Purpose:** Give admins a "History of Logs" view of who changed what, without every module reimplementing its own logging.

**Problem solved:** Without a shared mechanism, tracking "who created/edited/deleted this" would mean adding ad-hoc `createdBy`/`updatedBy` columns per table, or skipping it entirely and losing the audit trail the admin panel needs.

**Implementation:** `AuditLogsRepository` (`modules/audit-logs/audit-logs.repository.ts`) exposes exactly one write method, `record()` (insert-only — there is no `update`/`delete` on it, mirroring the `AuditLog` model's `@@map("audit_logs")` table having no mutation endpoints at all). Any service that performs a write worth auditing takes `AuditLogsRepository` as a constructor dependency — the same cross-module-repository pattern `ApplicationsService` already used for `DocumentsRepository` — and calls `.record({ actorUserId, action, entityType, entityId, details })` right after the write succeeds. `action`/`entityType` are plain strings (constants in `audit-actions.ts`), not DB enums, so adding a new logged action later is a one-line addition, no migration. The read side (`GET /api/audit-logs`) goes through a normal thin `AuditLogsService` for filtering/shaping, kept separate from the write side.

**Advantages:** New auditable actions are a two-line change (constant + `.record()` call) in the service that already performs the write, right next to the code it's describing; no risk of the log entry and the actual mutation getting out of sync since they happen in the same request.

**Disadvantages:** Not transactional with the mutation it describes (a crash between the write and the `.record()` call loses that one log entry) — acceptable for an admin activity feed, not acceptable if this were ever repurposed as a compliance-grade audit log requiring atomicity.

**Example usage:** `backend/src/modules/users/users.service.ts` (`USER_CREATED`/`USER_UPDATED`/`USER_DELETED`), `backend/src/modules/job-postings/job-postings.service.ts`, `backend/src/modules/applications/applications.service.ts` (`APPLICATION_SIFTED`).

**Related files:** `modules/audit-logs/audit-logs.repository.ts`, `modules/audit-logs/audit-actions.ts`, `frontend/src/features/admin/pages/AuditLogsPage.tsx`.

**Possible alternatives:** Prisma middleware/`$use()` hooks that auto-log every mutation (rejected — logs would fire for internal/system writes too, and lose the human-readable `details` string each service can construct from context it has but the ORM layer doesn't); a dedicated event bus (rejected as over-engineered for this module count, same reasoning as the DI decision in [decisions.md](./decisions.md)).

---

## Hand-rolled logistic regression, refit per request

**Purpose:** Turn a small, manually-curated historical dataset of real hire/not-hire outcomes into a hire-likelihood percentage for a live applicant, shown on Evaluate Applicants.

**Problem solved:** A real ML dependency (gradient-boosted trees, a Python training service) would overfit and add operational complexity for what's realistically a low-tens-to-low-hundreds-row dataset (DILG's own historical records, hand-typed via the owner-only Historical Hiring Data page). The training label (`HistoricalHiringRecord.wasHired`) is a fact, not a subjective score (an earlier version of this module used a hand-typed retrospective percentage instead - see docs/decisions.md's "only real data" entry for why that was replaced), which makes this genuine binary classification, not regression. Logistic regression is the right-sized classifier - stable on small n with regularization, and unlike a black-box model its coefficients are close to an explanation for free.

**Implementation:** `backend/src/modules/historical-hiring-data/hirePrediction.ts` exports pure functions only - `extractFeatures()` (maps an applicant-shaped input to a fixed 5-number feature vector: education rank, years of experience, an eligibility rank specific to this module - see the function's own comment for why it doesn't reuse an app-wide ranking, since none exists - award count, and total L&D hours), `fitLogisticRegression()` (standardizes each feature column, then batch gradient descent minimizing binary cross-entropy with L2 regularization - refusing to fit below `MIN_TRAINING_SAMPLES`), `predict()` (standardizes the input the same way, computes the sigmoid of the linear combination, returns a `[0, 100]` percentage - inherently bounded, no manual clamping needed), and `explain()` (each feature's contribution to the log-odds sum, the closest honest equivalent to an OLS "+X points" breakdown - see its own comment on why these don't sum to percentage points the way linear-model coefficients would). `HistoricalHiringDataService.predictForApplications()` refits the model fresh on every call rather than persisting a trained snapshot - deliberately, since fitting on ≤6 columns and a few hundred rows is computationally trivial, and refitting avoids an entire model-versioning/staleness-tracking subsystem that a dataset this size doesn't warrant.

**Advantages:** Zero new dependencies; every prediction is provably built from the current dataset (no staleness question to reason about); trained directly on real outcomes rather than a subjective label, so the percentage means what it says ("similar profiles were hired this often") rather than "similar profiles were rated this highly by one person's judgment"; L2 regularization keeps coefficients finite even on a small, separable dataset (e.g. "everyone with a doctorate in the sample was hired") where unregularized logistic regression would diverge.

**Disadvantages:** Assumes each feature acts independently on the log-odds - can't capture interaction effects (e.g. "eligibility matters more at higher education levels") the way a tree-based model could; refitting per request means prediction latency scales with dataset size (a non-issue at the expected scale, would need reconsidering if the dataset ever grew to tens of thousands of rows); the `explain()` breakdown is honest but less intuitive to read than the OLS version's direct percentage-point contributions, since log-odds don't decompose additively into the displayed percentage.

**Example usage:** `backend/src/modules/historical-hiring-data/hirePrediction.ts`, consumed by `historical-hiring-data.service.ts`'s `predictForApplications()`.

**Related files:** `historical-hiring-data.repository.ts` (loads training rows + applicant feature rows), `frontend/src/features/admin/components/EvaluationRow.tsx` (`renderHirePrediction()`, the display side).

**Possible alternatives:** A gradient-boosted model (XGBoost/LightGBM) - rejected, would need either a Python sidecar service (architectural departure from this codebase's single Node/Express process) or a native-binding npm package, and would overfit at the expected data scale anyway. A persisted "trained model" table with an explicit train/publish step - rejected as unnecessary ceremony given how cheap refitting is at this scale; revisit if the dataset grows enough that refit-per-request becomes a real cost. Plain OLS regression on a subjective percentage label - this module's original design, replaced same-day once the client clarified they wanted the label to be real hired/not-hired data, not a retrospective assessment.
