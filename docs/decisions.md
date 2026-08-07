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

**Decision:** `frontend/src/features/admin/` is a distinct feature with its own pages (`CreateJobPostingPage`, `EvaluateApplicantsPage`) under `/admin/*` routes, guarded by `<ProtectedRoute role="ADMIN">`. Applicant routes (`/jobs`, `/registration`, `/applications`) are guarded by `<ProtectedRoute role="APPLICANT">` and redirect an admin back to `/admin/jobs` if they try to hit them directly (and vice versa). `Layout`'s nav shows an entirely different link set per role rather than the same links with some hidden.

**Pros:** Clean separation matches "admin can only post jobs and evaluate applicants" literally — there's no code path where an admin session can reach the applicant registration wizard or an applicant session can reach evaluation screens.

**Cons:** Some duplication of route-guard boilerplate between the two route groups in `App.tsx`; acceptable at this route count.

**Future impact:** If a third role appears (e.g. a board member distinct from a full admin), `ProtectedRoute`'s `role` prop would need to accept an array, and `Layout`'s nav switch would need a third branch.

**Reference:** [architecture.md § Role-based routing](./architecture.md#role-based-routing-frontend), `frontend/src/shared/components/ProtectedRoute.tsx`, `frontend/src/App.tsx`.
