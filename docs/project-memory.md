# Project Memory

Last updated: 2026-08-07.

## Current Architecture

npm-workspaces monorepo. `backend/` = Express + TypeScript + Prisma/MySQL REST API, feature-first + Clean Architecture layering (routes → controller → service → repository), manual DI via `container.ts`. `frontend/` = React + TypeScript SPA (Vite), feature-first, JWT session in `localStorage` via `AuthContext`. Full detail: [architecture.md](./architecture.md).

## Major Components

- **Auth** (`backend/src/modules/auth`, `frontend/src/features/auth`): register/login, JWT issuance/verification.
- **Applicants** (`backend/src/modules/applicants`, `frontend/src/features/applicant-registration`): demographic profile, work experience, L&D interventions, awards, document uploads.
- **Job Postings** (`backend/src/modules/job-postings`, `frontend/src/features/job-postings`, `frontend/src/features/admin`): browse open postings (applicant), admin creation with computed 10-day closing date.
- **Applications** (`backend/src/modules/applications`, folded into the `applicant-registration` frontend feature for applicants): submit an application to a posting, enforcing eligibility/promotional document requirements.
- **Admin / Evaluation** (`backend/src/modules/applications` evaluate endpoints, `frontend/src/features/admin`): separate role-gated section (`/admin/*`) where an `ADMIN` posts jobs (`CreateJobPostingPage`) and scores/decides on applications per posting (`EvaluateApplicantsPage`). See [decisions.md](./decisions.md) for why this is a single score+decision rather than the spec's full multi-board-member evaluation-forms system.

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

- **Admin UI is minimal.** Covers only job posting creation and single-score application evaluation. There's still no screen for admins to validate Eligibility=N applicants, review sifting results, or manage multi-board evaluation forms.
- **No automatic job-posting close job.** `JobPosting.status` doesn't flip to `CLOSED` on a timer; `JobPostingsService.isAcceptingApplications()` checks `closingAt` at submission time as a safeguard, but a stale `OPEN` posting past its window will still *list* as open in the UI (just can't be applied to).
- **Local disk file storage** — not durable across redeploys, not production-ready (see [decisions.md](./decisions.md)).
- **No automated tests yet** — `vitest` is wired into both `package.json`s but no test files exist.
- **Known dependency vulnerabilities (dev-only):** `npm audit` flags Vite/Vitest/react-router at moderate–critical severity; fixes require major version bumps (Vite 5→8, Vitest 2→4, react-router-dom 6→7) that weren't attempted in this pass to avoid destabilizing a fresh scaffold. Safe to defer since these affect the dev server / build tooling, not the shipped runtime bundle, but should be revisited before any production deployment.

## Technical Debt

- Frontend `types.ts` files duplicate backend DTO shapes by hand; no generated client (e.g. OpenAPI/tRPC) keeping them in sync.
- `ApplicantsRepository`/`ApplicationsRepository` etc. return Prisma's generated types directly rather than mapped domain models — acceptable at this scale, but if domain logic grows more complex than "check field, throw AppError," consider introducing real domain model classes distinct from Prisma's row types.
- `PATCH /api/applications/:id/evaluate` lets any admin silently overwrite a previous evaluation (no evaluator identity check, no history). Fine for a single-evaluator MVP; not fine once the spec's 13-member board is modeled (see [decisions.md](./decisions.md)).

## Future Work

In priority order, following the RSP pipeline in [rsp-domain-spec.md](./rsp-domain-spec.md):

1. **Admin console**: job posting *editing* (currently create-only), manual eligibility validation queue (surfacing the `eligibilityValidated`/Eligibility=N red-flag from the spec).
2. **Sifting**: automatic qualification check against a posting's QS fields, qualified/non-qualified table, bulk letter-sending.
3. **PQE**: batch scheduling (AM/PM/max 60 applicants), pass/fail recording, notification letters.
4. **Evaluation (full)**: replace the current single-score `Application.evaluationScore` with a proper multi-evaluator `Evaluation` model (13-board-member access, per-battery-test forms), feeding CompAss.
5. **Tabulation / CompAss**: ranked matrix generation, shortlisting at the 1:5 ratio, regret/shortlist letters.
6. **Deliberation, Compliance to Requirements, Onboarding**: per the spec's step-by-step process.
7. **Learning & Development / PDC modules**: POMS ranking, L&D plans, permit-to-study workflow.

## Outstanding Tasks

- Add automated tests (unit tests for services with fake repositories; integration tests for the Express app).
- Decide on and implement object storage before any real deployment.
- Address the dependency vulnerabilities noted above.
