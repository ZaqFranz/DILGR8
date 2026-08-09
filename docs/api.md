# API Reference

Base URL: `http://localhost:4000/api` (configurable via `VITE_API_URL` on the frontend, `PORT` on the backend).

All error responses share this shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid request body", "details": { "...": "..." } } }
```

Authenticated routes require `Authorization: Bearer <accessToken>`.

Three roles exist: `APPLICANT` (self-registers via `/auth/register`), `ADMIN`, and `PANEL` (both of the latter are admin-provisioned via `POST /api/users` — see [decisions.md](./decisions.md) for why `PANEL` was added as a full third role rather than an admin sub-type). Admin-only routes are marked **ADMIN**, panel-only routes **PANEL**; everything else marked "applicant" is open to any authenticated user in practice but is only meaningful for applicants (the frontend also route-guards by role — see [architecture.md § Role-based routing](./architecture.md#role-based-routing-frontend)).

## Auth — `/api/auth`

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/register` | none | `{ email, password }` | Creates a `User` with role `APPLICANT`. Returns `{ accessToken, user }`. |
| POST | `/login` | none | `{ email, password }` | Returns `{ accessToken, user }`. |
| PATCH | `/me/password` | any authenticated role | `{ currentPassword, newPassword }` | Self-service password change - works identically for `APPLICANT`/`ADMIN`/`PANEL` since it acts on the caller's own `User` row (`req.user.id`), not a role-specific one. 400 with a `currentPassword` field error if `currentPassword` doesn't match; `newPassword` must be ≥8 characters (same rule as registration). 204 on success. Does **not** invalidate other active tokens for the same user - see [decisions.md](./decisions.md). |

## Applicants — `/api/applicants` (all require auth)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/me` | — | Current user's applicant profile with relations. 404 if not created yet. |
| POST | `/me` | `CreateApplicantProfileDto` | Creates the profile (one per user; 409 if it already exists). |
| PATCH | `/me` | `Partial<CreateApplicantProfileDto>` | Updates the profile. |
| POST | `/me/complete-registration` | — | Marks the applicant as fully registered (`registrationCompletedAt`). 400 if `hasEligibility` is true and no `ELIGIBILITY_PROOF` document has been uploaded yet. Idempotent — calling it again after completion just returns the profile unchanged. The frontend gates every other applicant page on this flag (see [architecture.md § Role-based routing](./architecture.md#role-based-routing-frontend)) so no applicant data collection is deferred to after login. |
| POST | `/me/work-experiences` | `{ inclusiveFrom, inclusiveTo?, positionDesignation, agency }` | |
| DELETE | `/me/work-experiences/:id` | — | 404 if the record doesn't belong to the caller. |
| POST | `/me/ld-interventions` | `{ title, dateAttended, numberOfHours, sponsoringAgency }` | |
| DELETE | `/me/ld-interventions/:id` | — | |
| POST | `/me/awards` | `{ title, dateAwarded, issuingBody }` | |
| DELETE | `/me/awards/:id` | — | |
| POST | `/me/documents` | `multipart/form-data`: `file`, `type`, `applicationId?`, `ldInterventionId?` | `type` ∈ `ELIGIBILITY_PROOF`, `IPCR`, `DESIGNATION_ORDER`, `LD_PROOF`, `OTHER`. PDF/JPEG/PNG only, ≤5MB. `ldInterventionId` (required in practice for `LD_PROOF`, but not DTO-enforced) must belong to the caller's own `LdIntervention` row or 404s - it's how the Learning & Development section's per-entry proof upload attaches a file to the specific claim it backs up. |
| GET | `/me/documents` | — | Lists the caller's uploaded documents. |
| DELETE | `/me/documents/:id` | — | Deletes the DB record and the file on disk. |

### `CreateApplicantProfileDto`

```ts
{
  firstName: string; middleName?: string; lastName: string; suffix?: string;
  dateOfBirth: string;          // ISO date
  sex: "MALE" | "FEMALE";
  civilStatus: "SINGLE" | "MARRIED" | "WIDOWED" | "SEPARATED";
  address: string; contactNumber: string;
  hasEligibility: boolean;
  eligibilityType: "RA1080" | "CSC_PROFESSIONAL" | "CSC_SUBPROFESSIONAL" | "BARANGAY" | "NONE";
  // eligibilityType must be set (non-NONE) when hasEligibility is true
}
```

## Job Postings — `/api/job-postings`

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| GET | `/` | none | — | Query `?status=OPEN|CLOSED` optional. Public so applicants can browse before logging in. |
| GET | `/:id` | none | — | |
| POST | `/` | ADMIN | `CreateJobPostingDto` | Creates a posting; `closingAt` is computed server-side as `postedAt + 10 days, 23:59:59`. |
| PATCH | `/:id` | ADMIN | `UpdateJobPostingDto` | Partial update, including `status` (e.g. to close a posting manually). |
| DELETE | `/:id` | ADMIN | — | 409 if the posting has any submitted applications — close it instead of deleting (see [decisions.md](./decisions.md)). |

### `UpdateJobPostingDto`

```ts
{
  title?: string; description?: string;
  monthlySalary?: string; placeOfAssignment?: string;
  positionLevel?: "ENTRY" | "PROMOTIONAL";
  qualificationEducation?: string; qualificationTraining?: string;
  qualificationExperience?: string; qualificationEligibility?: string;
  requiredEligibilityTypes?: ("RA1080" | "CSC_PROFESSIONAL" | "CSC_SUBPROFESSIONAL" | "BARANGAY")[];
  duties?: string;
  status?: "OPEN" | "CLOSED";
}
```

`CreateJobPostingDto` is the same shape with every field (except `status`, which isn't settable on create) required rather than optional, and `requiredEligibilityTypes` defaulting to `[]` if omitted. `description` is free-text role/duties overview, distinct from the four `qualification*` fields (which are the formal QS requirements) — it's what the applicant-facing "View Details" modal on `JobPostingsListPage` leads with. `monthlySalary` is free-text (not numeric) so it can carry a formatted salary grade string (e.g. `"₱27,000.00"`); `placeOfAssignment` and `duties` are free-text too, with `duties` expected as one duty per line — the frontend splits on `\n` to render it as a numbered list. These three fields (plus the pre-existing `description`) were added to mirror the level of detail on typical DILG job-posting flyers (salary, assignment, duties enumerated alongside the qualification standards).

`requiredEligibilityTypes` is the machine-enforced eligibility gate, separate from the free-text `qualificationEligibility` field: an empty array (the default) means no eligibility is required to apply; a non-empty array is checked against the applicant's own `eligibilityType` at submission time (see `POST /api/applications` below) and — on the frontend — disables the "Apply" button up front with an explanatory message rather than letting the applicant find out only after submitting. Stored via the `job_posting_required_eligibilities` join table (see [database.md](./database.md)), flattened to this array on every response.

## Applications — `/api/applications` (all require auth)

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/` | applicant | `{ jobPostingId }` | Submits an application. Validates: profile exists, posting is open and within its 10-day window, not already applied, and — if `positionLevel === PROMOTIONAL` — an `IPCR` and `DESIGNATION_ORDER` document have been uploaded. If the posting has any `requiredEligibilityTypes`, 400s unless the applicant has `hasEligibility: true` **and** `eligibilityType` is one of them (message lists the accepted types); separately, if `hasEligibility` is true, an `ELIGIBILITY_PROOF` document must have been uploaded regardless of whether the posting requires eligibility. |
| GET | `/me` | applicant | — | Lists the caller's applications with their job posting. |
| GET | `/` | ADMIN | — | Lists applications for evaluation. Query `?jobPostingId=<uuid>` optional (unfiltered otherwise). Each entry includes the applicant's name/email and the job posting. |
| PATCH | `/:id/sift` | ADMIN | `SiftApplicationDto` | The Sifting phase's pass/fail call against the posting's qualification standards (education/training/experience/eligibility). Sets `status` to the decision and stamps `siftedAt`/`siftedByUserId`/`siftingRemarks`. 400 unless current status is `UNDER_SIFTING` (every application starts there automatically on submit - see below). |
| POST | `/import-exam-scores` | ADMIN | multipart: `file` (`.xlsx`/`.xls`) + `jobPostingId` | Imports Pre-Qualifying Examination (PQE) scores, conducted outside the system. Expects a header row with "Name"/"Score" columns; each row is matched against that posting's `QUALIFIED` applicants by trying several normalized name forms per applicant (`firstName lastName`, plus `firstName middleName lastName` and `firstName middleInitial. lastName` when a middle name is on file, each optionally with `suffix` appended) — case/whitespace/period-insensitive, so "Gibo R. Ormeneta" matches an applicant on file as firstName "Gibo", middleName "R.", lastName "Ormeneta" just as well as plain "Gibo Ormeneta" does. On match, sets `examinationScore`/`examinationScoredAt`. Returns `{ matched: [{applicationId, applicantName, score}], unmatched: [{name, score}] }` — non-matches aren't an error, the admin reviews and can fix names and re-upload. |
| PATCH | `/:id/schedule-interview` | ADMIN | `ScheduleInterviewDto` | Moves the application into the interview stage (`status: FOR_INTERVIEW`), making it visible to assigned panelists' `GET /panel-evaluations/my-queue`. 400 unless `status === "QUALIFIED"` **and** `examinationScore` is recorded — sifting and the PQE score must both be done first. 400 if `scheduledAt` isn't in the future. Stamps `interviewScheduledAt`/`interviewVenue`/`interviewAttire`/`interviewNotes`, all of which are rendered into the notification email so the applicant actually knows when/where to show up and what to wear, rather than a vague "the panel will be in touch." |
| PATCH | `/:id/withdraw` | applicant | — | Applicant-initiated withdrawal of their own application. 404 if the application doesn't exist or doesn't belong to the caller (an applicant can't distinguish the two cases). 400 unless current status is `SUBMITTED`/`UNDER_SIFTING`/`QUALIFIED`/`FOR_INTERVIEW` — `NOT_QUALIFIED` and `WITHDRAWN` itself are terminal and can't be withdrawn (from either state, there's nothing left to withdraw). Sets `status: WITHDRAWN` and stamps `withdrawnAt`. |

`POST /`, `PATCH /:id/sift`, `POST /import-exam-scores`, `PATCH /:id/schedule-interview`, and `PATCH /:id/withdraw` each email the applicant after their write succeeds (application received / sifted qualified-or-not / PQE score recorded / scheduled for interview / withdrawn, respectively), via `EmailService` (`backend/src/shared/email/emailService.ts`). Real sending requires `SMTP_HOST` (+ optional `SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`/`SMTP_SECURE`/`SMTP_FROM`) in `backend/.env`; with `SMTP_HOST` unset (the default - see `.env.example`), the email is logged to the console prefixed `[DEV EMAIL]` instead of sent, so this is fully testable without a mail server. Either path: a send failure is logged, never thrown - none of these endpoints fail because a notification couldn't go out.

### `ScheduleInterviewDto`

```ts
{
  scheduledAt: string; // ISO datetime, must be in the future
  venue: string;
  attire?: string;
  notes?: string;
}
```

### `SiftApplicationDto`

```ts
{
  decision: "QUALIFIED" | "NOT_QUALIFIED";
  remarks?: string;
}
```

No numeric score here - Sifting is a pass/fail checklist call (per the domain spec's Sifting phase), distinct from both the PQE score (`examinationScore`, imported separately) and the interview panel's per-criterion scoring (`PanelScore`, see below).

## Users — `/api/users` (all ADMIN only)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/` | — | Query `?role=ADMIN|APPLICANT|PANEL&search=<email substring>` both optional. Never returns `passwordHash`. |
| POST | `/` | `{ email, password, role }` | Admin-provisioned account creation — the only way to create an `ADMIN` or `PANEL` user (aside from `prisma/seed.ts`). 409 on duplicate email. |
| PATCH | `/:id` | `{ email?, role? }` | No password field — there's no admin-initiated password reset yet (see project-memory.md). |
| DELETE | `/:id` | — | 400 if you try to delete your own account. Deleting a user cascades to their `Applicant` profile (if any) and everything under it; job postings they created or applications they evaluated are kept, with the FK set to null (see [decisions.md](./decisions.md)). |

## Audit Logs — `/api/audit-logs` (ADMIN only, read-only)

| Method | Path | Notes |
|---|---|---|
| GET | `/` | Query `?entityType=User|JobPosting|Application&limit=<1-500, default 200>`. Newest first. No POST/PATCH/DELETE exist for this resource — see [decisions.md](./decisions.md) for why an audit trail has no mutation path through the API at all. |

Each entry: `{ id, action, entityType, entityId, details, createdAt, actor: { email } | null }`. `action` is a plain string (`USER_CREATED`, `USER_UPDATED`, `USER_DELETED`, `JOB_POSTING_CREATED`, `JOB_POSTING_UPDATED`, `JOB_POSTING_DELETED`, `APPLICATION_SIFTED`, `APPLICATION_EXAM_SCORES_IMPORTED`, `APPLICATION_SCHEDULED_INTERVIEW`, `CRITERION_CREATED`, `CRITERION_UPDATED`, `CRITERION_DELETED`, `PANEL_ASSIGNED`, `PANEL_UNASSIGNED`, `PANEL_EVALUATION_SUBMITTED`), not a DB enum, so new action types don't need a migration.

## Dashboard — `/api/dashboard` (ADMIN only, read-only)

| Method | Path | Notes |
|---|---|---|
| GET | `/summary` | No query params. Aggregates counts directly from `User`/`Applicant`/`JobPosting`/`Application` (not routed through those modules' own repositories - a cross-cutting reporting read, the same pattern `AuditLogsRepository` uses) plus the 8 most recent audit log entries. |

Response shape:

```
{
  applicants: { total, registrationComplete },
  users: { total, byRole: { ADMIN, APPLICANT, PANEL } },
  jobPostings: { total, byStatus: { OPEN, CLOSED } },
  applications: { total, byStatus: { SUBMITTED, UNDER_SIFTING, FOR_INTERVIEW, QUALIFIED, NOT_QUALIFIED, WITHDRAWN } },
  topJobPostings: [{ jobPostingId, title, applicationCount }],  // top 5, by application count
  recentActivity: AuditLogEntry[]  // same shape as GET /api/audit-logs, limit 8
}
```

Every status/role key is always present with a count of `0` rather than omitted - `groupBy` only returns rows for combinations that exist, so the service fills every known enum value before responding, letting the frontend render a fixed set of chart rows without a presence check per key.

## Evaluation Criteria — `/api/evaluation-criteria`

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| GET | `/` | ADMIN or PANEL | — | The interview rubric. `PANEL` callers only get `isActive` criteria (what they need to render a scoring form); `ADMIN` sees inactive ones too so they can be reactivated. |
| POST | `/` | ADMIN | `{ name, maxScore, sortOrder? }` | Adds a criterion. `maxScore` doubles as its weight — a panelist's total for one application is the sum of their per-criterion scores. |
| PATCH | `/:id` | ADMIN | `{ name?, maxScore?, sortOrder?, isActive? }` | `isActive: false` retires a criterion without deleting it. |
| DELETE | `/:id` | ADMIN | — | 409 if the criterion has any recorded `PanelScore`s — deactivate it instead so past scores stay intact. |

## Interview Panel Assignments — `/api/panel-assignments` (all ADMIN only)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/` | — | Query `?jobPostingId=<uuid>` optional. Each entry includes the assigned panelist's `{ id, email }`. |
| POST | `/` | `{ jobPostingId, panelUserId }` | Assigns a `PANEL`-role user to a posting's interview board. 400 if `panelUserId` isn't role `PANEL`; 409 if already assigned to that posting. |
| DELETE | `/:id` | — | Unassigns. Any scores that panelist already submitted for that posting's applications are kept. |

## Panel Evaluations — `/api/panel-evaluations`

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| GET | `/my-queue` | PANEL | — | Applications with `status: FOR_INTERVIEW` across every posting the caller is assigned to, each including the caller's own existing evaluation (if any) so the frontend can pre-fill an in-progress form. |
| PATCH | `/:applicationId` | PANEL | `{ remarks?, scores: [{ criterionId, score }] }` | Upserts the caller's own evaluation for that application (one per panelist per application — re-submitting overwrites, mirroring `applications.sift`'s upsert-on-resubmit pattern). 400 if the application isn't `FOR_INTERVIEW`, a score is missing for any active criterion, or a score exceeds that criterion's `maxScore` (the spec's mandatory-field + threshold rules); 403 if the caller isn't assigned to that application's posting. |
| GET | `/tabulation/:jobPostingId` | ADMIN | — | The CompAss ranked matrix for a posting: every assigned panelist, and per application (`FOR_INTERVIEW`/`QUALIFIED`/`NOT_QUALIFIED`) each panelist's total score, the average across panelists who've submitted, a descending rank, and `panelistsSubmitted`/`panelistsAssigned` counts (drives the "N of M haven't scored yet" warning `EvaluateApplicantsPage` shows before an admin finalizes early). |

## Health

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Liveness check, outside `/api`. |
