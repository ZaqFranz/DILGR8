# Architecture Decisions

## 2026-08-07 — Manual DI via composition root instead of a DI framework

**Context:** `CLAUDE.md` mandates Dependency Injection as an architecture principle. Options were a framework (`tsyringe`, `inversify`) or manual constructor injection wired in one file.

**Decision:** Manual constructor injection, wired in `backend/src/container.ts`.

**Pros:** No extra dependency or decorator/reflection setup; fully readable without tooling; trivial to fake collaborators in tests by calling `new Service(fakeRepo)` directly.

**Cons:** Doesn't auto-scale — as the module count grows, `container.ts` will grow linearly and someone has to remember to wire new modules in by hand.

**Future impact:** If the module count roughly doubles (i.e. once Sifting, PQE, Evaluation, etc. are built out), revisit whether a lightweight DI container is worth the tradeoff. Not needed yet.

**Reference:** [patterns.md § Dependency Injection](./patterns.md#dependency-injection-manual-via-composition-root).

---

## 2026-08-07 — Prisma as the ORM, MySQL as the database

**Context:** The brief specified MySQL and "database migration, models, CRUD automation" without naming an ORM. Candidates: Prisma, TypeORM, Sequelize.

**Decision:** Prisma.

**Pros:** Strong generated TypeScript types (matches the "strict typing" coding standard), a first-class migration CLI (`prisma migrate dev`), a readable single-file schema that doubles as documentation.

**Cons:** Prisma's query API is less flexible than raw TypeORM query builders for very complex joins; generated client needs a build step (`prisma generate`) that must run after `npm install` and after every schema change.

**Future impact:** Complex reporting queries needed later (e.g. CompAss ranking matrices) may need raw SQL via `prisma.$queryRaw` rather than the query builder. Acceptable tradeoff for now.

**Reference:** [database.md](./database.md).

---

## 2026-08-07 — Documents stored on local disk, not object storage

**Context:** Applicants upload eligibility proof, IPCR, and Designation Order files. Needed a storage backend for the first pass.

**Decision:** Local disk (`backend/uploads/`, via Multer's `diskStorage`), with only file metadata in the `documents` table.

**Pros:** Zero external dependency/cost for local development and demoing.

**Cons:** Doesn't survive container restarts or scale past a single server instance; not production-ready as-is.

**Future impact:** Before any real deployment, swap `documents.upload.ts`'s storage engine for S3-compatible object storage (e.g. via `multer-s3` or a manual upload-then-record flow). The `Document` model's `filePath` field is storage-engine-agnostic (just a string), so this swap shouldn't require a schema change — only the multer storage config and the (not-yet-built) file-serving/download endpoint.

**Reference:** [database.md § documents](./database.md#documents).

---

## 2026-08-07 — IPCR/Designation/Eligibility-proof documents are applicant-level, not application-level

**Context:** The domain spec ties IPCR and "Designation to a Higher Position" documents to promotional *applications*, and eligibility proof to the applicant's eligibility checklist. A document can't be linked to an `Application` until the `Application` row exists, but the application-submission validation needs to check the documents exist *before* creating that row — a chicken-and-egg problem if documents were required to reference an application at upload time.

**Decision:** `Document.applicationId` is optional. IPCR, Designation Order, and Eligibility Proof documents are uploaded against the applicant (no `applicationId`) during registration, and `ApplicationsService.submit()` checks for their *existence and type* on the applicant, not for a specific link to the application being created.

**Pros:** Avoids the ordering problem entirely; also lets an applicant reuse the same IPCR/Designation Order across multiple promotional applications submitted within the same 10-day window, which matches "may apply for different positions at once."

**Cons:** If an applicant later needs *different* IPCR documents for two different promotional applications, this model can't distinguish which document backs which application — it only checks "does at least one exist." Not a requirement in the current spec, so left unhandled.

**Future impact:** If per-application document requirements become necessary, `Application.submit()` would need to accept explicit document IDs instead of inferring from type, and the frontend would need to prompt for that during the apply flow.

**Reference:** [database.md § documents](./database.md#documents), `backend/src/modules/applications/applications.service.ts`.

---

## 2026-08-07 — Evaluation implemented as a single score+decision on `Application`, not a full board evaluation-forms system

**Context:** The domain spec's Evaluation phase involves 13 board members each filling per-battery-test forms, feeding a Comparative Assessment (CompAss) ranking. The immediate ask was "admin can post jobs and evaluate applicants" — a much smaller scope.

**Decision:** Added four fields directly to `Application` (`evaluationScore`, `evaluationRemarks`, `evaluatedAt`, `evaluatedByUserId`) rather than a separate `Evaluation`/`EvaluationForm` model. Any one `ADMIN` user can record one score (0-100) + decision (`QUALIFIED`/`NOT_QUALIFIED`) + remarks per application via `PATCH /api/applications/:id/evaluate`, which overwrites the previous evaluation if run again.

**Pros:** Matches the requested scope exactly with minimal schema/API surface; the mandatory-field and score-threshold validation the spec calls out for "Eval Forms" is satisfied by the DTO (`score` and `decision` required, `score` bounded 0-100).

**Cons:** Doesn't model multiple evaluators, per-battery-test scores, or CompAss ranking at all — "evaluate" here means one person's overall score, and a second admin evaluating the same application silently overwrites the first. Not acceptable once the real multi-board-member Evaluation phase is built.

**Future impact:** When the full Evaluation phase from the RSP spec is implemented, this will need to become a proper `Evaluation` model (one row per evaluator per battery test, `Application` 1:N `Evaluation`), with the current `evaluationScore`/`evaluationRemarks`/`evaluatedAt`/`evaluatedByUserId` fields on `Application` likely repurposed as a computed/aggregate summary rather than raw input. Flagged in project-memory.md's technical debt.

**Reference:** [database.md § applications](./database.md#applications), [api.md § Applications](./api.md#applications--apiapplications-all-require-auth), `backend/src/modules/applications/`.

---

## 2026-08-07 — Admin and applicant are separate route trees, not the same pages with conditional UI

**Context:** Asked for the admin panel to be visibly different from the applicant experience, with admins restricted to posting jobs and evaluating applicants only.

**Decision:** `frontend/src/features/admin/` is a distinct feature with its own pages under `/admin/*` routes, guarded by `<ProtectedRoute role="ADMIN">`. Applicant routes (`/jobs`, `/register`, `/applications`) are guarded by `<ProtectedRoute role="APPLICANT">` and redirect an admin back to `/admin/jobs` if they try to hit them directly (and vice versa). `Layout`'s nav shows an entirely different link set per role rather than the same links with some hidden. (Superseded/extended by the sidebar-shell decision below — the admin pages were originally `CreateJobPostingPage`/`EvaluateApplicantsPage` under the same top nav as applicants; now they're `JobManagementPage`/`UsersManagementPage`/`EvaluateApplicantsPage`/`AuditLogsPage` under `AdminShell`'s sidebar. `/registration` was later merged into `/register` — see the 2026-08-08 unified-registration decision below.)

**Pros:** Clean separation matches "admin can only post jobs and evaluate applicants" literally — there's no code path where an admin session can reach the applicant registration wizard or an applicant session can reach evaluation screens.

**Cons:** Some duplication of route-guard boilerplate between the two route groups in `App.tsx`; acceptable at this route count.

**Future impact:** If a third role appears (e.g. a board member distinct from a full admin), `ProtectedRoute`'s `role` prop would need to accept an array, and `Layout`'s nav switch would need a third branch.

---

## 2026-08-08 — Admin panel redesigned around a sidebar shell (`AdminShell`), not the shared top nav

**Context:** Asked for the admin panel to look like "an admin panel setup" — sidebar navigation — with full CRUD for Users, Jobs, and a new History of Logs section, distinct from the two-link top nav the admin section had before.

**Decision:** `frontend/src/features/admin/components/AdminShell.tsx` renders a left sidebar (Job Management / Users Management / Evaluate Applicants / History of Logs, active-highlighted via `useLocation()`) and every `/admin/*` page wraps its content in it. `Layout`'s top bar drops the admin nav links entirely (they'd be redundant with the sidebar) and stays minimal for admins; it also swaps `.app-main`'s centered-960px styling for a full-width `.app-main--full` when `pathname.startsWith("/admin")`, so the sidebar isn't squeezed into the applicant pages' narrow column.

**Pros:** Reads as a distinct admin product surface, not applicant pages with extra links; matches conventional admin-panel UX (persistent left nav) rather than the applicant section's simple top nav.

**Cons:** `AdminShell` is repeated as a wrapper in every admin page component rather than applied once via a nested-route `<Outlet/>` layout — chosen to keep the existing children-prop routing pattern in `App.tsx` unchanged (lower risk than restructuring routing) at the cost of one extra import/wrap per admin page.

**Future impact:** If the admin page count grows much further, revisit converting `/admin/*` to a nested-route layout (`<Route path="/admin" element={<AdminShell/>}>` with child `<Outlet/>` routes) to stop repeating the wrapper. Not needed at four pages.

**Reference:** [architecture.md § Role-based routing](./architecture.md#role-based-routing-frontend), `frontend/src/features/admin/components/AdminShell.tsx`.

---

## 2026-08-08 — Audit log (`AuditLog`) has no update/delete path, by design

**Context:** "History of Logs" needed a backing data model. The ask was framed as part of "complete CRUD" for the admin panel, but an audit trail that admins can edit or delete isn't actually an audit trail — it's just another editable table.

**Decision:** `AuditLogsRepository` only exposes `record()` (create) and `findMany()` (read). There is no `PATCH`/`DELETE` route, controller method, or repository method for `AuditLog` at any layer — not even admin-gated. Entries are written automatically by other services after a successful write (see [patterns.md § Audit Trail](./patterns.md#audit-trail-append-only-log-via-injected-repository)).

**Pros:** The log stays trustworthy as a record of what actually happened; no risk of an admin (accidentally or otherwise) editing history to hide an earlier action.

**Cons:** No way to redact a log entry that contains something it shouldn't (e.g. if a `details` string ever included sensitive data by mistake) short of a direct database operation outside the app. Acceptable given `details` strings are built from data already visible elsewhere in the admin panel (emails, job titles, scores) — nothing logged that isn't already exposed via the CRUD screens themselves.

**Future impact:** If regulatory/compliance requirements ever demand log redaction, that should be a narrowly-scoped, heavily-audited-itself operation (e.g. a one-off maintenance script with its own logging), not a general API endpoint.

**Reference:** [database.md § audit_logs](./database.md#audit_logs), [api.md § Audit Logs](./api.md#audit-logs--apiaudit-logs-admin-only-read-only).

---

## 2026-08-08 — `JobPosting.createdByUserId` and `Application.evaluatedByUserId` are nullable/`SetNull`, so admins are deletable

**Context:** Users Management needed real delete capability. `JobPosting.createdByUserId` was originally a required field with Prisma's default `Restrict` behavior on delete, which would silently block deleting any admin who had ever posted a job — surprising and undiscoverable from the Users Management UI (the delete would just fail with a generic FK error).

**Decision:** Made `createdByUserId` optional (`String?`) with an explicit `onDelete: SetNull`, matching the pattern `evaluatedByUserId` on `Application` already used. Deleting a user now always succeeds (except for self-delete, blocked at the service layer) and severs the creator/evaluator link on their past job postings/evaluations rather than blocking or cascading.

**Pros:** "Delete a user" behaves predictably regardless of what that user has done in the system; job postings and evaluation history survive the deletion of whoever made them, which matches how the History of Logs already preserves entries after actor deletion (`AuditLog.actorUserId` is also nullable/`SetNull`).

**Cons:** After deleting an admin, their past job postings/evaluations show no creator/evaluator in the UI (`createdBy`/`evaluatedBy` becomes `null`) — there's no "deleted user" placeholder value, just absence. Acceptable since the `AuditLog` history still records what they did (with `actor: null` shown as "(deleted user)" in `AuditLogsPage`), even after the `User` row itself is gone.

**Reference:** [database.md § job_postings](./database.md#job_postings), `backend/prisma/schema.prisma`.

---

## 2026-08-08 — Registration unified into one flow; applicant pages gated on `registrationCompletedAt`

**Context:** The original design split applicant onboarding into two steps: `POST /auth/register` (email/password only, at `/register`) immediately followed by a redirect to a separate post-login wizard (`/registration`, behind `<ProtectedRoute role="APPLICANT">`) for the demographic profile, work experience, L&D, awards, and documents. Nothing stopped an authenticated applicant from navigating straight to `/jobs` or `/applications` without ever finishing the wizard — the "rest of the flow" was reachable, and skippable, only by choice of navigation, not by enforcement. Explicit product direction: all applicant information must be captured as part of registration, not deferred to after the applicant is already logged in and using the app.

**Decision:** Merged the account-creation form and the former wizard into a single component, `RegistrationPage` (`frontend/src/features/applicant-registration/pages/RegistrationPage.tsx`), mounted at one route (`/register`). It renders the account step for unauthenticated visitors and continues in place through profile → work experience → L&D → awards → documents after `register()` succeeds, with no route change in between. Added `Applicant.registrationCompletedAt` (nullable `DateTime`) and `POST /api/applicants/me/complete-registration`, called when the applicant finishes the last step (validates an eligibility-proof document has been uploaded if `hasEligibility` is true). `AuthContext` exposes `registrationComplete` (fetched from `GET /api/applicants/me` right after login/register and on session restore); `ProtectedRoute` and `HomeRedirect` redirect any applicant with `registrationComplete === false` to `/register`, whichever page they try to reach directly. The old `RegisterPage.tsx` and `RegistrationWizardPage.tsx` were deleted.

**Pros:** Matches the "collect everything at registration" requirement literally — there is no code path to `/jobs` or `/applications` that bypasses profile/work-experience/L&D/awards/documents. `/register` also stays reachable after completion (e.g. Layout's "My Profile" link) so applicants can still edit their record without a separate profile-editing surface to maintain.

**Cons:** `AuthContext` now depends on the `applicant-registration` feature's API module (`getMyProfile`) to resolve `registrationComplete`, which is a cross-feature import `shared/auth` didn't previously have. Every protected-route render for an applicant does one extra `GET /api/applicants/me` round trip on session restore/login (cheap single-row lookup, not on every navigation) that a JWT-embedded claim could have avoided at the cost of needing to re-issue tokens whenever registration status changes.

**Future impact:** If more roles or a "partially registered admin" concept is ever introduced, `registrationComplete` and the redirect logic in `ProtectedRoute`/`HomeRedirect` should generalize to a role-keyed "onboarding complete" check rather than the current `APPLICANT`-only branch.

**Reference:** [architecture.md § Registration gating](./architecture.md#registration-gating-frontend), [database.md § applicants](./database.md#applicants), [api.md § Applicants](./api.md#applicants--apiapplicants-all-require-auth).

**Reference:** [architecture.md § Role-based routing](./architecture.md#role-based-routing-frontend), `frontend/src/shared/components/ProtectedRoute.tsx`, `frontend/src/App.tsx`.
