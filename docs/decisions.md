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

**Superseded/extended:** the multi-evaluator system this entry anticipated was built on 2026-08-08 (see the entry below) — `evaluationScore`/`evaluationRemarks`/etc. on `Application` were kept as-is (the admin's own final decision) rather than repurposed, with the panel's per-evaluator scores living in new `PanelEvaluation`/`PanelScore` tables instead. Then, in a second 2026-08-08 entry ("Sifting/PQE/Interview pipeline"), this single free-standing "evaluate" action was itself repurposed into the Sifting phase's pass/fail call (`evaluationScore` dropped, `evaluationRemarks`/`evaluatedAt`/`evaluatedByUserId` renamed `siftingRemarks`/`siftedAt`/`siftedByUserId`) once it became clear it was standing in for Sifting all along, not a genuine final decision.

**Reference:** [database.md § applications](./database.md#applications), [api.md § Applications](./api.md#applications--apiapplications-all-require-auth), `backend/src/modules/applications/`.

---

## 2026-08-07 — Admin and applicant are separate route trees, not the same pages with conditional UI

**Context:** Asked for the admin panel to be visibly different from the applicant experience, with admins restricted to posting jobs and evaluating applicants only.

**Decision:** `frontend/src/features/admin/` is a distinct feature with its own pages under `/admin/*` routes, guarded by `<ProtectedRoute role="ADMIN">`. Applicant routes (`/jobs`, `/register`, `/applications`) are guarded by `<ProtectedRoute role="APPLICANT">` and redirect an admin back to `/admin/jobs` if they try to hit them directly (and vice versa). `Layout`'s nav shows an entirely different link set per role rather than the same links with some hidden. (Superseded/extended by the sidebar-shell decision below — the admin pages were originally `CreateJobPostingPage`/`EvaluateApplicantsPage` under the same top nav as applicants; now they're `JobManagementPage`/`UsersManagementPage`/`EvaluateApplicantsPage`/`AuditLogsPage` under `AdminShell`'s sidebar. `/registration` was later merged into `/register` — see the 2026-08-08 unified-registration decision below.)

**Pros:** Clean separation matches "admin can only post jobs and evaluate applicants" literally — there's no code path where an admin session can reach the applicant registration wizard or an applicant session can reach evaluation screens.

**Cons:** Some duplication of route-guard boilerplate between the two route groups in `App.tsx`; acceptable at this route count.

**Future impact:** If a third role appears (e.g. a board member distinct from a full admin), `ProtectedRoute`'s `role` prop would need to accept an array, and `Layout`'s nav switch would need a third branch.

---

## 2026-08-08 — Eligibility gate at application submission: structured per-posting requirement, join table over JSON/scalar-list

**Context:** Applicants without the eligibility a posting requires were able to apply — `ApplicationsService.submit()` only checked that a self-declared-eligible applicant had uploaded *some* `ELIGIBILITY_PROOF` document, never that their `eligibilityType` actually satisfied the posting. The posting side had no structured field to compare against: `JobPosting.qualificationEligibility` is free text (e.g. "RA 1080 or CSC Professional required") written by an admin for applicants to read, not something the backend can parse reliably. Fixing this required deciding how a posting expresses which eligibility type(s) it needs.

**Decision:** Added `JobPostingRequiredEligibility`, a join table (`jobPostingId`, `eligibilityType`, unique together) rather than a Prisma scalar-list field or a `Json` column on `JobPosting`. `JobPostingsRepository` flattens the join rows into a `requiredEligibilityTypes: EligibilityType[]` array on every read and replaces the full set (`deleteMany` + `create`) on update, so every other layer (service, controller, frontend) just sees a plain array — the join table is an implementation detail. An empty array means no eligibility is required. `ApplicationsService.submit()` now 400s before creating the application unless `applicant.hasEligibility && posting.requiredEligibilityTypes.includes(applicant.eligibilityType)` (skipped entirely when the array is empty), and the frontend's `JobPostingsListPage` disables/relabels the "Apply" button using the same check so an ineligible applicant is told why before clicking, not after. The pre-existing "if you claim eligibility, prove it with a document" check is unchanged and still runs independently.

**Pros:** A join table matches the codebase's existing style for admin-managed one-to-many links (`PanelAssignment` is structurally identical) and lets Prisma/MySQL enforce the schema directly, rather than trusting an unvalidated `Json` blob or working around MySQL's lack of native scalar-list support. Keeping the free-text `qualificationEligibility` field alongside it (rather than deriving display text from the structured array) preserves whatever nuance an admin already wrote there for applicants to read, while the structured array is the only thing enforcement logic touches.

**Cons:** Two eligibility-related fields on `JobPosting` now (`qualificationEligibility` free text, `requiredEligibilityTypes` structured) that admins must keep in sync by hand — nothing stops them drifting (e.g. the text says "RA 1080 preferred" while the checkboxes require CSC Professional). A join table also means every job-posting read does an extra `include`, though at this data volume it's immaterial.

**Future impact:** If eligibility requirements ever need per-posting nuance beyond "any one of these types" (e.g. "RA 1080 AND 2 years experience", or an eligibility type that's only acceptable for certain positions), the flat `EligibilityType[]` check in `ApplicationsService.submit()` is the first place to extend — it's isolated to a single `if` block, not spread across the codebase.

**Reference:** [database.md § job_posting_required_eligibilities](./database.md#job_posting_required_eligibilities), [api.md § Job Postings](./api.md#job-postings--apijob-postings) / [§ Applications](./api.md#applications--apiapplications-all-require-auth), `backend/src/modules/job-postings/job-postings.repository.ts`, `backend/src/modules/applications/applications.service.ts`, `frontend/src/features/job-postings/pages/JobPostingsListPage.tsx`.

---

## 2026-08-08 — Applicant-initiated application withdrawal: allowed up to FOR_INTERVIEW, not logged to the audit trail

**Context:** `Application.status` has included `WITHDRAWN` since the pipeline's first migration, but nothing ever set it - there was no applicant-facing withdraw action. `docs/rsp-domain-spec.md` has zero mentions of "withdraw"; there's no specified cutoff for when an applicant may withdraw, so which statuses should allow it was an undocumented call to make. Separately, every other `Application` transition (`sift`, `scheduleInterview`, exam-score import) is admin/panel-initiated and gets an `AuditLog` entry; `submit()` - the only prior applicant-initiated transition - does not, per the existing "applicant-side actions aren't audited yet" convention (see Audit Logging in `docs/project-memory.md`).

**Decision:** An application can be withdrawn (`PATCH /api/applications/:id/withdraw`) from `SUBMITTED`/`UNDER_SIFTING`/`QUALIFIED`/`FOR_INTERVIEW` - i.e. any non-terminal status. `NOT_QUALIFIED` and `WITHDRAWN` itself are excluded (400) since both are already terminal outcomes with nothing left to withdraw from. Ownership is enforced the same way `submit`/`listMine` do it - resolve the caller's own `Applicant` row via `userId`, then compare `application.applicantId` against it - and a mismatch 404s (not 403), so an applicant probing another applicant's application ID can't distinguish "not yours" from "doesn't exist." Like `submit()`, `withdraw()` does not write an `AuditLog` entry, staying consistent with the existing applicant-action convention rather than auditing this one applicant action while every other one stays unaudited.

**Pros:** The status whitelist matches how the rest of the pipeline already treats `NOT_QUALIFIED`/`WITHDRAWN` as terminal (nothing else transitions out of them either). Reusing `submit`/`listMine`'s exact ownership-resolution pattern, rather than inventing a new one, keeps applicant-scoped resource access consistent across the module.

**Cons:** The specific cutoff (through `FOR_INTERVIEW`, not further) is a judgment call with no spec backing it - a real DILG process might want to disallow withdrawal once an interview is scheduled, or allow it all the way through Deliberation once that phase exists. Not auditing applicant-initiated actions at all (submit, now withdraw) means there's no admin-visible trail if an applicant repeatedly submits and withdraws, though the audit log's stated purpose (`docs/decisions.md`'s audit-trail entry, `docs/patterns.md`) has always been about admin/panel write accountability, not applicant activity monitoring.

**Future impact:** If the domain spec is ever clarified with an explicit withdrawal cutoff, the whitelist is a single `WITHDRAWABLE_STATUSES` constant in `applications.service.ts` to change. If applicant-side audit logging is added later (tracked as a known gap in `docs/project-memory.md`), `withdraw()` should get the same treatment as `submit()` in that pass, not be singled out now.

**Reference:** [database.md § applications](./database.md#applications), [api.md § Applications](./api.md#applications--apiapplications-all-require-auth), `backend/src/modules/applications/applications.service.ts`, `frontend/src/features/applicant-registration/pages/MyApplicationsPage.tsx`.

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

---

## 2026-08-08 — Interview panel & CompAss tabulation: multi-criteria rubric, admin-assigned panelists, `Application.evaluate` left unguarded

**Context:** Building the real multi-evaluator Evaluation phase the 2026-08-07 entry above deferred. Two scope forks needed deciding: (1) does a panelist give one overall interview score, or score several separately-weighted criteria; (2) can any `PANEL` account score any interview-stage applicant, or only ones on postings an admin explicitly assigned them to. Both were resolved toward the more literal reading of the domain spec's "evaluation forms" and "13 board members" framing rather than the simpler option.

**Decision:** Added `Role.PANEL` (a full third role, not an admin sub-type — provisioned the same way as `ADMIN`, through Users Management's existing role `<select>`) and `ApplicationStatus.FOR_INTERVIEW`. Four new tables: `EvaluationCriterion` (admin-editable rubric, `maxScore` doubling as weight), `PanelAssignment` (admin-managed M:N, posting × panel user), `PanelEvaluation` + `PanelScore` (one evaluation per panelist per application, with per-criterion score rows, upserted on re-submit). `PATCH /applications/:id/schedule-interview` (new, admin-only) moves an application to `FOR_INTERVIEW`; the existing `PATCH /applications/:id/evaluate` is unchanged and still finalizes regardless of current status — no server-side check blocks an admin from qualifying/disqualifying an application before every assigned panelist has scored it. `GET /panel-evaluations/tabulation/:jobPostingId` computes the ranked CompAss matrix (sum per panelist, average across panelists, descending rank) at read time in application code, surfaced as two extra columns on `EvaluateApplicantsPage` rather than a separate matrix view.

**Pros:** The rubric being admin-editable matches the spec's "administrator can edit/update evaluation forms" literally, rather than hardcoding assumed criteria the spec doesn't actually enumerate. Assignment-gating matches how real interview boards are staffed (not every panelist should see every posting) and is enforced server-side (`PanelEvaluationsService.submit` 403s a panelist scoring an application on a posting they're not assigned to), not just hidden in the UI. Leaving `evaluate` unguarded keeps the admin's finalize action simple and avoids a second source of truth for "is this ready to decide" — the tabulation view already shows `panelistsSubmitted`/`panelistsAssigned` for the admin to judge.

**Cons:** No server-side block on premature finalization means the only guard against an admin qualifying an applicant before the board has finished scoring is a frontend warning (`EvaluationRow` reads `panelistsSubmitted < panelistsAssigned` from the tabulation response) — bypassable by calling the API directly. Criteria are global, not per-posting or per-battery-test, so every interview board scores against the same rubric regardless of position; the spec's "per battery test/activity" framing could imply otherwise, but nothing in the actual ask required per-posting rubrics, and building that would mean either duplicating criteria per posting or adding a join table with no concrete requirement driving its shape yet.

**Future impact:** If premature finalization turns out to be a real problem in practice (not just a theoretical gap), add a server-side check in `ApplicationsService.evaluate()` requiring `panelistsSubmitted === panelistsAssigned` for `FOR_INTERVIEW` applications, mirroring the pattern already used for `JobPostingsService.delete`'s guard. If per-posting or per-battery-test rubrics become a real requirement, `EvaluationCriterion` would need a nullable `jobPostingId` (global rubric when null, override when set) rather than a breaking schema change. Letter/notice generation and the spec's 1:5 auto-shortlisting ratio (both listed under the domain spec's "Tabulation" section) remain unimplemented — a separate notifications/documents feature.

**Reference:** [architecture.md § Interview panel & CompAss tabulation](./architecture.md#interview-panel--compass-tabulation), [database.md § evaluation_criteria / panel_assignments / panel_evaluations](./database.md#evaluation_criteria), [api.md § Evaluation Criteria](./api.md#evaluation-criteria--apievaluation-criteria), `backend/src/modules/evaluation-criteria/`, `backend/src/modules/panel-assignments/`, `backend/src/modules/panel-evaluations/`.

**Superseded/extended:** `PATCH /applications/:id/evaluate` no longer exists as of the 2026-08-08 "Sifting/PQE/Interview pipeline" entry below — it was repurposed into the Sifting decision (`PATCH /applications/:id/sift`, gated to `UNDER_SIFTING`) and there's no longer any post-interview "finalize" action at all, so the premature-finalization gap this entry flags is moot for now (the pipeline simply stops at `FOR_INTERVIEW` until a future Deliberation phase is built).

---

## 2026-08-08 — Sifting/PQE/Interview pipeline: repurpose the free-standing "evaluate" action, add an Excel-based PQE score import

**Context:** The Dashboard already tallied `ApplicationStatus` (`SUBMITTED`/`UNDER_SIFTING`/`FOR_INTERVIEW`/`QUALIFIED`/`NOT_QUALIFIED`/`WITHDRAWN`), but only `SUBMITTED`, `FOR_INTERVIEW`, and `QUALIFIED`/`NOT_QUALIFIED` were ever actually set — `UNDER_SIFTING` had no code path at all, and `QUALIFIED`/`NOT_QUALIFIED` were set by a free-standing "Evaluate Applicants" action (0-100 score + decision + remarks, callable from any status) that had drifted into being a generic final-call tool rather than anything tied to a specific RSP phase, once the real per-criterion panel scoring (`PanelEvaluation`/`PanelScore`) was built separately. The user described the intended order explicitly: Submitted → Under Sifting → Qualified → Examination (external; system just records the score) → For Interview (admin schedules, applicant emailed) → Panel Tabulation (already built) — which matches the domain spec's Sifting phase (pass/fail against education/training/experience/eligibility) and PQE phase (batch exam, score recorded, notice sent regardless of pass/fail) exactly.

**Decision:** Repurposed the existing "evaluate" action into the Sifting decision: `Application.evaluationScore` dropped (sifting is pass/fail, not scored), `evaluationRemarks`/`evaluatedAt`/`evaluatedByUserId` renamed `siftingRemarks`/`siftedAt`/`siftedByUserId`, and `PATCH /applications/:id/evaluate` became `PATCH /applications/:id/sift` (`SiftApplicationDto = { decision, remarks? }`), now gated to `status === UNDER_SIFTING` (previously callable from any status). `ApplicationsRepository.create()` now sets `status: "UNDER_SIFTING"` directly instead of relying on the `@default(SUBMITTED)` schema default, so every application is "Under Sifting" the instant it's submitted — no separate manual "start sifting" step. Added `Application.examinationScore`/`examinationScoredAt` and a new `POST /applications/import-exam-scores` (multipart: `.xlsx`/`.xls` + `jobPostingId`, `ADMIN`-only) that parses an Excel file (`exceljs`, `Name`/`Score` header columns) and matches each row by normalized full name against that posting's `QUALIFIED` applicants — matches get the score + a `[DEV EMAIL]`/SMTP notification, non-matches come back in the response for the admin to review and re-upload rather than failing the whole import. `PATCH /applications/:id/schedule-interview`'s guard changed from `status in {SUBMITTED, UNDER_SIFTING}` to `status === QUALIFIED && examinationScore !== null`, enforcing sifting-then-PQE-then-interview in that order.

**Pros:** Fixes a real semantic bug rather than adding a parallel feature — the old "evaluate" action was already standing in for Sifting, just without the name, the gating, or the pipeline position to show it. The Excel import matches how PQE results actually arrive in practice (a batch exam run outside the system, results tabulated in a spreadsheet) without requiring the admin to hand-enter scores one row at a time. Name-matching with a reviewable unmatched list is more forgiving than an all-or-nothing import — a handful of formatting mismatches don't block everyone else's scores from landing.

**Cons:** Name-matching is inherently fuzzier than an ID-based join — two applicants with the same normalized name on the same posting would collide (last-write-wins in the lookup map), and a typo in the spreadsheet silently produces an "unmatched" row rather than a hard error pointing at the specific cell. No pass/fail threshold is enforced on the PQE score itself (by explicit choice - score is informational, the admin decides whether to schedule an interview), so nothing stops an admin from scheduling an interview for a very low PQE score. The applicant-facing stage tracker's "Examination" node doesn't visually distinguish "awaiting a score" from "scored, awaiting interview scheduling" - both render as the same in-progress node, with the actual score (if any) shown as a line of text underneath instead.

**Future impact:** If PQE score collisions on duplicate names become a real problem, the import would need a secondary identifier (e.g. an applicant reference number column) rather than name-only matching. If a pass/fail threshold is ever wanted, `examinationScore`'s consumer (`scheduleInterview`'s guard) is the one place to add it - no schema change needed since the score is already a plain `Int`. The pipeline still stops at `FOR_INTERVIEW`/panel tabulation - Deliberation (the RD's final decision), Compliance to Requirements, and Onboarding remain future work per project-memory.md.

**Reference:** [api.md § Applications](./api.md#applications--apiapplications-all-require-auth), [database.md § applications](./database.md#applications), `backend/src/modules/applications/`, `backend/src/modules/applications/examScoreParser.ts`, `frontend/src/features/applicant-registration/components/ApplicationStageTracker.tsx`.

**Bugfix (same day):** The first cut of name-matching (`firstName lastName` only) turned out to fail on real data immediately - the actual test applicant has a middle name (`R.`) on file, and a PQE sheet naturally lists the fuller "Gibo R. Ormeneta," which the bare two-part key never matched (reported as "0 matched, 2 unmatched" on a real import attempt). Fixed by having `normalizeName()` also strip `.`/`,` (so "R." and "R" are equivalent) and adding `buildNameVariants()`, which indexes every `QUALIFIED` applicant under several plausible spellings — `firstName lastName`, `firstName middleName lastName`, `firstName middleInitial. lastName`, and each of those again with `suffix` appended when present — rather than a single fixed key.
