# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Initial project scaffold: npm workspaces monorepo (`backend`, `frontend`).
- `CLAUDE.md` governance/workflow rules and `docs/` structure (architecture, api, database, patterns, decisions, project-memory, troubleshooting, rsp-domain-spec).
- Backend: Express + TypeScript API with feature-first Clean Architecture (`modules/{auth,applicants,job-postings,applications}`), Prisma ORM against MySQL, JWT authentication, centralized error handling, request validation (Zod), Pino logging.
- Frontend: React + TypeScript (Vite) SPA with feature-first structure, JWT-aware API client.
- Applicant Registration feature (Application phase of the RSP pipeline): account registration/login, demographic profile, work experience, learning & development interventions, eligibility checklist with proof upload, awards, IPCR/Designation-to-Higher-Position upload for promotional applications, job posting listing, and application submission.
- Local MySQL database provisioned (via XAMPP's bundled MariaDB) and initial Prisma migration applied, creating all tables per `docs/database.md`. Seed data adds one admin user and two sample job postings.
- Applicant Registration wizard now auto-advances to the next step when the demographic profile is first created, and every step has Back/Next navigation (`frontend/src/features/applicant-registration/pages/RegistrationWizardPage.tsx`).
- Admin panel, separated from the applicant experience by role-gated routing (`/admin/*` vs `/jobs`, `/registration`, `/applications`): a "Post a Job" page and an "Evaluate Applicants" page (score 0-100, qualified/not-qualified decision, remarks per application). Backend: `evaluationScore`/`evaluationRemarks`/`evaluatedAt`/`evaluatedByUserId` added to `Application`, plus `GET /api/applications` (admin listing, optionally filtered by job posting) and `PATCH /api/applications/:id/evaluate` (both `ADMIN`-only). Frontend: new `admin` feature, and `ProtectedRoute` gained a `role` prop enforced on both the admin and applicant route groups.
- Fixed an auth race condition where an already-logged-in user landing on `/` was bounced to `/login` and stuck there (session hydration from `localStorage` happened after route guards had already decided). `AuthContext` now exposes `isLoading`; `ProtectedRoute`/`HomeRedirect` wait on it.
- Admin panel redesigned around a sidebar shell (`AdminShell`) with four sections, and full CRUD added for Job Management and (new) Users Management, plus a new read-only History of Logs section:
  - **Job Management**: `JobManagementPage` replaces the old create-only "Post a Job" page with a data table (Edit/Delete per row, inline delete confirmation, no native browser dialogs). Backend: `PATCH`/`DELETE /api/job-postings/:id` (`ADMIN`-only); deleting a posting with existing applications is blocked (409) to prevent silent data loss via cascade.
  - **Users Management** (new): `UsersManagementPage` - admin-provisioned account creation (including new admins), role/email editing, deletion with a self-delete guard. Backend: new `users` module (`GET/POST /api/users`, `PATCH/DELETE /api/users/:id`, all `ADMIN`-only).
  - **History of Logs** (new): `AuditLogsPage`, read-only, filterable by entity type. Backend: new `audit_logs` table and `audit-logs` module (`GET /api/audit-logs`, `ADMIN`-only, no write endpoints by design). Wired into Users/Job Postings/Application-evaluation services to record `USER_*`, `JOB_POSTING_*`, and `APPLICATION_EVALUATED` entries.
  - Schema: `JobPosting.createdByUserId` and the new `AuditLog.actorUserId` are nullable with `onDelete: SetNull`, so deleting a user never blocks on, or cascades into deleting, their past job postings/log entries.
