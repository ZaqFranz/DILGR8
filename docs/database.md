# Database

MySQL via Prisma. Schema source of truth: `backend/prisma/schema.prisma`.

## Entity overview

```
User (1) ── (1) Applicant (1) ── (N) WorkExperience
   │                      │  ── (N) LdIntervention
   │                      │  ── (N) Award
   │                      │  ── (N) Document
   │                      │  ── (N) Application ── (1) JobPosting
   │                      │                     └── (N) Document (IPCR/DesignationOrder, applicationId set)
   │
   ├── (N) JobPosting (createdBy, nullable)
   ├── (N) Application (evaluatedBy, nullable)
   └── (N) AuditLog (actor, nullable)
```

## Tables

### `users`
Auth identity. `role` is `APPLICANT` (default) or `ADMIN`. Password stored as a bcrypt hash, never plaintext. Full CRUD via `/api/users` (ADMIN only) — see [api.md](./api.md); a user can't delete their own account.

### `applicants`
One row per registered applicant, created once via `POST /api/applicants/me`. Holds the demographic profile plus the eligibility flag (`hasEligibility`, `eligibilityType`, `eligibilityValidated`).

- `eligibilityValidated` always starts `false`. It exists for the admin-side manual validation workflow described in the domain spec (Eligibility=N is "subject to manual validation"; Eligibility=Y still needs an admin to confirm the uploaded proof) — **the admin validation UI itself is not built yet** (tracked in project-memory.md).
- `registrationCompletedAt` (nullable) is set once via `POST /api/applicants/me/complete-registration`, after the applicant has gone through profile, work experience, L&D, awards, and documents. The frontend uses it (via `AuthContext.registrationComplete`) to gate access to the rest of the app — see [architecture.md § Registration gating](./architecture.md#registration-gating-frontend) — so applicant data collection is never deferred to after the applicant is already using the app.

### `work_experiences`, `ld_interventions`, `awards`
Simple child tables of `applicants`, one row per entry the applicant adds. Cascade-deleted with the applicant.

### `documents`
Uploaded files. `applicantId` is always set; `applicationId` is set only for documents tied to a specific application (currently unused by the frontend — IPCR/Designation/Eligibility proof are uploaded at the applicant level and checked by type, not by application, to avoid a chicken-and-egg problem at submission time). Files are stored on local disk under `backend/uploads/` (path in `filePath`); only metadata lives in the DB.

### `job_postings`
A vacancy. `positionLevel` is `ENTRY` or `PROMOTIONAL`. `closingAt` is computed at creation time in `JobPostingsService.computeClosingAt()` as `postedAt + 10 days, 23:59:59` per the domain spec's 10-day application window. `status` is `OPEN`/`CLOSED`; there is no scheduled job yet to flip it automatically when `closingAt` passes (`JobPostingsService.isAcceptingApplications()` checks both `status` and `closingAt` at submission time as a safeguard) — admins can also close a posting manually via `PATCH`.

`createdByUserId` is nullable with `onDelete: SetNull` (not the required/Restrict Prisma would default to) specifically so deleting the admin who posted a job doesn't get blocked by, or cascade into deleting, the posting — see [decisions.md](./decisions.md). Deleting a posting itself is blocked (409) while it has any applications, to avoid silently wiping out submitted applications via cascade; close it instead.

### `applications`
Join between `applicants` and `job_postings`, unique on `(applicantId, jobPostingId)` — an applicant may apply to several postings but only once each. `status` defaults to `SUBMITTED`. `UNDER_SIFTING` is unused (sifting isn't implemented yet); `QUALIFIED`/`NOT_QUALIFIED` are set by the admin evaluation flow (`PATCH /api/applications/:id/evaluate`), which also stamps `evaluationScore` (0-100), `evaluationRemarks`, `evaluatedAt`, and `evaluatedByUserId` (→ `users.id`). `WITHDRAWN` exists in the enum but nothing sets it yet — there's no applicant-facing withdraw action.

This is a deliberately simplified stand-in for the domain spec's full Evaluation phase (13-member board, per-battery-test forms, mandatory-field + score-threshold validation feeding into CompAss). What's implemented covers only the last part — a single score/decision/remarks recorded by whichever admin evaluates the application — as a first cut; see [decisions.md](./decisions.md) for the scope call and [project-memory.md](./project-memory.md) for what's still future work.

### `audit_logs`
Append-only history of admin write actions: `USER_CREATED/UPDATED/DELETED`, `JOB_POSTING_CREATED/UPDATED/DELETED`, `APPLICATION_EVALUATED`. `action` and `entityType` are plain strings, not DB enums, so new action types don't need a migration (see `backend/src/modules/audit-logs/audit-actions.ts` for the known set). `actorUserId` is nullable with `onDelete: SetNull` — deleting a user preserves the log entries they created, just with the actor link severed rather than the rows disappearing. There is deliberately no `PATCH`/`DELETE` on `/api/audit-logs` — see [decisions.md](./decisions.md).

## Conventions

- All primary keys are `String @id @default(uuid())`.
- All child tables cascade-delete (`onDelete: Cascade`) when their parent (`Applicant`/`Application`) is deleted.
- Timestamps: `createdAt`/`updatedAt` on every table except `documents` and `applications`, which only need `uploadedAt`/`submittedAt` (immutable records — see [decisions.md](./decisions.md)).
- Table names are snake_case (`@@map`); TypeScript-facing model names are PascalCase (Prisma default).

## Migrations

Run `npm run prisma:migrate --workspace backend` (wraps `prisma migrate dev`) after changing `schema.prisma`. Seed data (`prisma/seed.ts`) creates one admin user (`admin@dilg.gov.ph` / `ChangeMe123!` — change immediately in any non-local environment) and two sample job postings (one `ENTRY`, one `PROMOTIONAL`).
