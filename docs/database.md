# Database

MySQL via Prisma. Schema source of truth: `backend/prisma/schema.prisma`.

## Entity overview

```
User (1) ── (1) Applicant (1) ── (N) WorkExperience
   │                      │  ── (N) LdIntervention ── (N) Document (LD_PROOF, ldInterventionId set)
   │                      │  ── (N) Award
   │                      │  ── (N) Document
   │                      │  ── (N) Application ── (1) JobPosting
   │                      │                     ├── (N) Document (IPCR/DesignationOrder, applicationId set)
   │                      │                     └── (N) PanelEvaluation ── (N) PanelScore ── (1) EvaluationCriterion
   │
   ├── (N) JobPosting (createdBy, nullable)
   ├── (N) Application (siftedBy, nullable)
   ├── (N) AuditLog (actor, nullable)
   ├── (N) PanelAssignment (panelUser) ── (1) JobPosting
   └── (N) PanelEvaluation (panelUser)
```

## Tables

### `users`
Auth identity. `role` is `APPLICANT` (default), `ADMIN`, or `PANEL` (interview board members - see the `panel_assignments`/`panel_evaluations` tables below). Password stored as a bcrypt hash, never plaintext. Full CRUD via `/api/users` (ADMIN only) — see [api.md](./api.md); a user can't delete their own account.

### `applicants`
One row per registered applicant, created once via `POST /api/applicants/me`. Holds the demographic profile plus the eligibility flag (`hasEligibility`, `eligibilityType`, `eligibilityValidated`).

- `eligibilityValidated` always starts `false`. It exists for the admin-side manual validation workflow described in the domain spec (Eligibility=N is "subject to manual validation"; Eligibility=Y still needs an admin to confirm the uploaded proof) — **the admin validation UI itself is not built yet** (tracked in project-memory.md).
- `registrationCompletedAt` (nullable) is set once via `POST /api/applicants/me/complete-registration`, after the applicant has gone through profile, work experience, L&D, awards, and documents. The frontend uses it (via `AuthContext.registrationComplete`) to gate access to the rest of the app — see [architecture.md § Registration gating](./architecture.md#registration-gating-frontend) — so applicant data collection is never deferred to after the applicant is already using the app.

### `work_experiences`, `ld_interventions`, `awards`
Simple child tables of `applicants`, one row per entry the applicant adds. Cascade-deleted with the applicant. `ld_interventions` additionally has an optional `Document[]` back-relation (`LD_PROOF` type) - see `documents` below.

### `documents`
Uploaded files. `applicantId` is always set; `applicationId` is set only for documents tied to a specific application (currently unused by the frontend — IPCR/Designation/Eligibility proof are uploaded at the applicant level and checked by type, not by application, to avoid a chicken-and-egg problem at submission time). `ldInterventionId` is set only for `LD_PROOF` documents, tying a proof file (certificate, attendance record, etc.) to the specific `LdIntervention` claim it backs up - `onDelete: Cascade`, so removing an L&D entry removes its proof files too. An intervention may have zero, one, or several proof documents; the frontend shows them as a small per-row list on `LdInterventionSection` rather than in the generic flat `DocumentsSection` list. Files are stored on local disk under `backend/uploads/` (path in `filePath`); only metadata lives in the DB.

### `job_postings`
A vacancy. `description` (`@db.Text`, required) is a free-text overview of the role/duties, separate from the four `qualification*` fields below it (the formal QS requirements) — only shown to applicants behind `JobPostingsListPage`'s "View Details" modal, not on the list card itself. `monthlySalary` (`VARCHAR(191)`, required) is a free-text salary string rather than a numeric column, so it can carry formatted values like `"₱27,000.00"`; it's shown on both the list card and the details modal. `placeOfAssignment` (`@db.Text`, required) and `duties` (`@db.Text`, required) are shown only in the details modal, alongside `description` and the qualification standards — `duties` is one duty per line, rendered by the frontend as a numbered list split on `\n`. These three fields were added to bring postings up to the level of detail on typical DILG job-posting flyers. `positionLevel` is `ENTRY` or `PROMOTIONAL`. `closingAt` is computed at creation time in `JobPostingsService.computeClosingAt()` as `postedAt + 10 days, 23:59:59` per the domain spec's 10-day application window. `status` is `OPEN`/`CLOSED`; there is no scheduled job yet to flip it automatically when `closingAt` passes (`JobPostingsService.isAcceptingApplications()` checks both `status` and `closingAt` at submission time as a safeguard) — admins can also close a posting manually via `PATCH`.

Because `monthlySalary`, `placeOfAssignment`, and `duties` were added as required columns after `job_postings` already had seeded rows, the migration (`20260808044639_add_salary_place_duties_to_job_posting`) follows the established add-nullable → backfill → enforce-NOT-NULL pattern (MySQL `TEXT`/`VARCHAR` columns backing a required field can't carry a `DEFAULT` in a single `ADD COLUMN ... NOT NULL`, since existing rows would violate it immediately) — same pattern used for `description` earlier.

`createdByUserId` is nullable with `onDelete: SetNull` (not the required/Restrict Prisma would default to) specifically so deleting the admin who posted a job doesn't get blocked by, or cascade into deleting, the posting — see [decisions.md](./decisions.md). Deleting a posting itself is blocked (409) while it has any applications, to avoid silently wiping out submitted applications via cascade; close it instead.

### `applications`
Join between `applicants` and `job_postings`, unique on `(applicantId, jobPostingId)` — an applicant may apply to several postings but only once each. The full pipeline: `SUBMITTED` → `UNDER_SIFTING` (set automatically by `ApplicationsRepository.create()` the instant an application is submitted - there's no separate "start sifting" step) → `QUALIFIED`/`NOT_QUALIFIED` (the Sifting phase's pass/fail call against the posting's qualification standards, via `PATCH /api/applications/:id/sift`, 400 unless currently `UNDER_SIFTING`) → PQE score recorded on a `QUALIFIED` application (`POST /api/applications/import-exam-scores`, an Excel import matched by applicant name - doesn't change `status`) → `FOR_INTERVIEW` (`PATCH /api/applications/:id/schedule-interview`, 400 unless `status === QUALIFIED` **and** `examinationScore` is set; also stamps `interviewScheduledAt`/`interviewVenue`/`interviewAttire`/`interviewNotes` from the admin-supplied `ScheduleInterviewDto`, so the notification email can tell the applicant when/where to show up and what to wear) → interview panel scoring (`panel_evaluations`/`panel_scores` below). `WITHDRAWN` exists in the enum but nothing sets it yet — there's no applicant-facing withdraw action. There's no status past `FOR_INTERVIEW` yet — the Deliberation phase (final RD decision) is future work, tracked in `docs/project-memory.md`.

Sifting stamps `siftingRemarks`/`siftedAt`/`siftedByUserId` (→ `users.id`) — pass/fail only, no numeric score, matching the domain spec's Sifting criteria (education/training/experience/eligibility). The PQE import stamps `examinationScore`/`examinationScoredAt`. Both are separate from the interview panel's per-criterion scoring below — the panel average is display-only context (via `GET /panel-evaluations/tabulation/:jobPostingId`), never written back onto `Application`.

### `evaluation_criteria`
The admin-editable interview rubric (domain spec: "administrator can edit/update evaluation forms"). Each row is one scoring criterion: `name`, `maxScore` (doubles as its weight — a panelist's total per application is the sum of their per-criterion scores), `sortOrder`, `isActive`. `isActive: false` retires a criterion without deleting it; `DELETE` is blocked (409) once any `panel_scores` row references it, the same shape as the `job_postings` delete-guard.

### `panel_assignments`
Which `PANEL` users sit on which job posting's interview board, unique on `(jobPostingId, panelUserId)`. Pure assignment metadata — both FKs `onDelete: Cascade`, since dropping the assignment when a posting or panel user is deleted has no data-loss implications (unlike `job_postings.createdByUserId`, there's nothing else referencing the assignment row). Determines both what a panelist can see (`GET /panel-evaluations/my-queue`) and score (`PATCH /panel-evaluations/:applicationId` 403s if not assigned).

### `panel_evaluations` / `panel_scores`
One panelist's scoring of one application. `panel_evaluations` is the header row (`applicationId`, `panelUserId` — unique together, `remarks`, timestamps); `panel_scores` holds the per-criterion values (`panelEvaluationId`, `criterionId` — unique together, `score`), cascade-deleted with the evaluation. Re-submitting a panelist's scores for the same application upserts the header and replaces every score row in one transaction (`PanelEvaluationsRepository.upsertEvaluation`), mirroring how `applications.evaluate` overwrites a prior admin evaluation rather than versioning it. `GET /panel-evaluations/tabulation/:jobPostingId` sums and averages these at read time (application code, not SQL) into the CompAss ranked matrix — see [architecture.md § Interview panel & CompAss tabulation](./architecture.md#interview-panel--compass-tabulation).

### `audit_logs`
Append-only history of admin/panel write actions: `USER_CREATED/UPDATED/DELETED`, `JOB_POSTING_CREATED/UPDATED/DELETED`, `APPLICATION_SIFTED`, `APPLICATION_EXAM_SCORES_IMPORTED`, `APPLICATION_SCHEDULED_INTERVIEW`, `CRITERION_CREATED/UPDATED/DELETED`, `PANEL_ASSIGNED/UNASSIGNED`, `PANEL_EVALUATION_SUBMITTED`. `action` and `entityType` are plain strings, not DB enums, so new action types don't need a migration (see `backend/src/modules/audit-logs/audit-actions.ts` for the known set). `actorUserId` is nullable with `onDelete: SetNull` — deleting a user preserves the log entries they created, just with the actor link severed rather than the rows disappearing. There is deliberately no `PATCH`/`DELETE` on `/api/audit-logs` — see [decisions.md](./decisions.md).

## Conventions

- All primary keys are `String @id @default(uuid())`.
- All child tables cascade-delete (`onDelete: Cascade`) when their parent (`Applicant`/`Application`) is deleted.
- Timestamps: `createdAt`/`updatedAt` on every table except `documents` and `applications`, which only need `uploadedAt`/`submittedAt` (immutable records — see [decisions.md](./decisions.md)).
- Table names are snake_case (`@@map`); TypeScript-facing model names are PascalCase (Prisma default).

## Migrations

Run `npm run prisma:migrate --workspace backend` (wraps `prisma migrate dev`) after changing `schema.prisma`. Seed data (`prisma/seed.ts`) creates one admin user (`admin@dilg.gov.ph` / `ChangeMe123!` — change immediately in any non-local environment) and two sample job postings (one `ENTRY`, one `PROMOTIONAL`).
