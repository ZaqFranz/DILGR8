# Project Memory

Last updated: 2026-08-08.

## Current Architecture

npm-workspaces monorepo. `backend/` = Express + TypeScript + Prisma/MySQL REST API, feature-first + Clean Architecture layering (routes → controller → service → repository), manual DI via `container.ts`. `frontend/` = React + TypeScript SPA (Vite), feature-first, JWT session in `localStorage` via `AuthContext`. Full detail: [architecture.md](./architecture.md).

## Major Components

- **Auth** (`backend/src/modules/auth`, `frontend/src/features/auth`): register/login, JWT issuance/verification. Registration's UI lives in the `applicant-registration` feature (see below), not `auth` — `auth` only owns the account-credentials endpoints and `LoginPage`.
- **Applicants** (`backend/src/modules/applicants`, `frontend/src/features/applicant-registration`): a single continuous registration flow (`RegistrationPage`, route `/register`) covering account creation, demographic profile, work experience, L&D interventions, awards, and document uploads — no applicant data collection happens after this flow, only edits to it. `POST /api/applicants/me/complete-registration` marks it done; `ProtectedRoute`/`HomeRedirect` block every other applicant page until `Applicant.registrationCompletedAt` is set (`AuthContext.registrationComplete`). See [architecture.md § Registration gating](./architecture.md#registration-gating-frontend).
- **Job Postings** (`backend/src/modules/job-postings`, `frontend/src/features/job-postings`, `frontend/src/features/admin`): browse open postings (applicant); full admin CRUD (`JobManagementPage`) with computed 10-day closing date and a delete guard that blocks removing a posting with submitted applications.
- **Applications** (`backend/src/modules/applications`, folded into the `applicant-registration` frontend feature for applicants): submit an application to a posting, enforcing eligibility/promotional document requirements.
- **Admin panel** (`frontend/src/features/admin`, wrapped in `AdminShell`'s sidebar layout): role-gated section (`/admin/*`, landing page is `/admin/dashboard`) with seven sections - **Dashboard** (`backend/src/modules/dashboard`; read-only aggregate counts - applicants, job postings by status, applications by status, top job postings by application count, recent audit activity - see [api.md § Dashboard](./api.md#dashboard--apidashboard-admin-only-read-only)), **Job Management** (full CRUD), **Users Management** (`backend/src/modules/users`; full CRUD on `User` incl. admin-provisioning new admins/panelists, self-delete blocked), **Evaluate Applicants** (schedules an application for interview, shows the CompAss panel-score matrix once scored, finalizes a score/decision/remarks - see [decisions.md](./decisions.md)), **Interview Panel** (`backend/src/modules/panel-assignments`; assigns `PANEL` users to a posting's interview board), **Evaluation Criteria** (`backend/src/modules/evaluation-criteria`; admin-editable interview rubric), and **History of Logs** (`backend/src/modules/audit-logs`; read-only, deliberately no update/delete path - see decisions.md).
- **Interview Panel & Tabulation** (`backend/src/modules/panel-evaluations`, `frontend/src/features/panel`): the real multi-evaluator Evaluation phase — `PANEL`-role users see their assigned interview queue (`GET /panel-evaluations/my-queue`, `MyInterviewsPage` at `/panel/interviews`) and score each application against the active rubric; admin views the resulting ranked CompAss matrix inline on Evaluate Applicants (`GET /panel-evaluations/tabulation/:jobPostingId`). See [architecture.md § Interview panel & CompAss tabulation](./architecture.md#interview-panel--compass-tabulation).

## Audit Logging

`AuditLog` records every Users/Job Postings/Evaluate/Interview-Panel write (job/user CRUD, application evaluate + schedule-interview, criterion CRUD, panel assign/unassign, panel evaluation submit — see [patterns.md § Audit Trail](./patterns.md#audit-trail-append-only-log-via-injected-repository)). Not (yet) instrumented: applicant-side actions (profile edits, document uploads, application submission) - only admin/panel actions are logged today. If "history of logs" needs to expand to cover applicant activity too, that's a straightforward extension of the same pattern in `ApplicantsService`/`DocumentsService`, not a redesign.

## Folder Structure

See [architecture.md](./architecture.md) and `README.md`'s tree.

## Coding Conventions

- Strict TypeScript everywhere (`strict: true`, `noUncheckedIndexedAccess` on the backend).
- Zod schemas are the single source of truth for both runtime validation and TS types (`z.infer`).
- Path alias `@/*` → `src/*` on both backend (resolved at build time via `tsc-alias`) and frontend (resolved by Vite).
- No comments explaining *what* code does; only *why*, and only when non-obvious (see repo-wide instruction in `CLAUDE.md`).

## Naming Conventions

- Backend files: `<feature>.<layer>.ts` (`applicants.service.ts`), sub-features nested in a folder (`applicants/documents/documents.service.ts`).
- Frontend: `PascalCase.tsx` for components/pages, `camelCase.ts` for api/util modules.
- Database tables: `snake_case` (via Prisma `@@map`); Prisma models: `PascalCase`.
- Git commits: Conventional Commits (`feat(...)`, `fix(...)`, etc.) — see `CLAUDE.md`.

## API Standards

REST under `/api`, JSON bodies, JWT bearer auth, uniform error shape `{ error: { code, message, details } }`. Full reference: [api.md](./api.md).

## Database Standards

MySQL, Prisma migrations (`prisma migrate dev`), UUID primary keys, cascade deletes from parent to child records, timestamps on every mutable table. Full reference: [database.md](./database.md).

## Known Limitations

- **Admin UI covers Dashboard, Job Management, Users Management, Evaluate Applicants, Interview Panel, Evaluation Criteria, and History of Logs.** There's still no screen for admins to validate Eligibility=N applicants or review sifting results (sifting isn't automated yet).
- **No server-side guard against finalizing an evaluation before every assigned panelist has scored.** `PATCH /applications/:id/evaluate` works regardless of `panelistsSubmitted` vs `panelistsAssigned`; only a frontend warning on `EvaluateApplicantsPage` catches it. See [decisions.md](./decisions.md#2026-08-08--interview-panel--compass-tabulation-multi-criteria-rubric-admin-assigned-panelists-applicationevaluate-left-unguarded).
- **Evaluation criteria are global, not per-posting or per-battery-test.** Every interview board scores against the same rubric regardless of position, even though the domain spec frames evaluation as "per battery test/activity."
- **No admin-initiated password reset.** `PATCH /api/users/:id` can change a user's email/role but not their password; a user who forgets their password has no self-serve or admin-assisted recovery path yet.
- **Audit log details aren't a diff.** `JobPostingsService.update()`/`UsersService.update()` log the entire submitted payload in `details`, not just the fields that actually changed - accurate but noisier than necessary to read (visible e.g. as a full job-posting JSON dump in History of Logs for a status-only edit).
- **No automatic job-posting close job.** `JobPosting.status` doesn't flip to `CLOSED` on a timer; `JobPostingsService.isAcceptingApplications()` checks `closingAt` at submission time as a safeguard, but a stale `OPEN` posting past its window will still *list* as open in the UI (just can't be applied to). Admins can close manually now via Job Management's edit form.
- **Local disk file storage** — not durable across redeploys, not production-ready (see [decisions.md](./decisions.md)).
- **No automated tests yet** — `vitest` is wired into both `package.json`s but no test files exist.
- **Known dependency vulnerabilities (dev-only):** `npm audit` flags Vite/Vitest/react-router at moderate–critical severity; fixes require major version bumps (Vite 5→8, Vitest 2→4, react-router-dom 6→7) that weren't attempted in this pass to avoid destabilizing a fresh scaffold. Safe to defer since these affect the dev server / build tooling, not the shipped runtime bundle, but should be revisited before any production deployment.

## Technical Debt

- `registrationComplete` (in `AuthContext`) is resolved via an extra `GET /api/applicants/me` call on session restore/login rather than being embedded in the JWT — simpler (no token-reissue-on-status-change problem) but costs one small round trip per session start. See [decisions.md](./decisions.md#2026-08-08--registration-unified-into-one-flow-applicant-pages-gated-on-registrationcompletedat).
- Frontend `types.ts` files duplicate backend DTO shapes by hand; no generated client (e.g. OpenAPI/tRPC) keeping them in sync.
- `ApplicantsRepository`/`ApplicationsRepository` etc. return Prisma's generated types directly rather than mapped domain models — acceptable at this scale, but if domain logic grows more complex than "check field, throw AppError," consider introducing real domain model classes distinct from Prisma's row types.
- `PATCH /api/applications/:id/evaluate` lets any admin silently overwrite a previous final decision (no evaluator identity check, no history) — this is intentionally still single-decision-maker even now that panel scoring is multi-evaluator, since the admin's finalize step is a distinct action from board scoring (see [decisions.md](./decisions.md)).
- `PATCH /api/panel-evaluations/:applicationId` has the same overwrite-not-version behavior for a panelist's own scores - re-submitting replaces the prior score/remarks with no history kept.

## Future Work

In priority order, following the RSP pipeline in [rsp-domain-spec.md](./rsp-domain-spec.md):

1. **Admin console**: manual eligibility validation queue (surfacing the `eligibilityValidated`/Eligibility=N red-flag from the spec); admin-initiated password reset.
2. **Sifting**: automatic qualification check against a posting's QS fields, qualified/non-qualified table, bulk letter-sending.
3. **PQE**: batch scheduling (AM/PM/max 60 applicants), pass/fail recording, notification letters.
4. ~~**Evaluation (full)**~~ — done 2026-08-08: multi-evaluator `PanelEvaluation`/`PanelScore` model, `PANEL`-role board access to a rubric of admin-editable `EvaluationCriterion` rows, feeding CompAss. See [architecture.md § Interview panel & CompAss tabulation](./architecture.md#interview-panel--compass-tabulation).
5. **Tabulation / CompAss**: ranked matrix generation ✅ (see above); still missing: shortlisting at the 1:5 ratio, regret/shortlist letters, PSL and QME.
6. **Deliberation, Compliance to Requirements, Onboarding**: per the spec's step-by-step process.
7. **Learning & Development / PDC modules**: POMS ranking, L&D plans, permit-to-study workflow.

## Outstanding Tasks

- Add automated tests (unit tests for services with fake repositories; integration tests for the Express app).
- Decide on and implement object storage before any real deployment.
- Address the dependency vulnerabilities noted above.
