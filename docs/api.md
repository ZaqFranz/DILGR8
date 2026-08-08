# API Reference

Base URL: `http://localhost:4000/api` (configurable via `VITE_API_URL` on the frontend, `PORT` on the backend).

All error responses share this shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid request body", "details": { "...": "..." } } }
```

Authenticated routes require `Authorization: Bearer <accessToken>`.

Two roles exist: `APPLICANT` (self-registers via `/auth/register`) and `ADMIN` (provisioned out-of-band, e.g. `prisma/seed.ts` — there is no self-serve way to become an admin). Admin-only routes are marked **ADMIN** below; everything else marked "applicant" is open to any authenticated user in practice but is only meaningful for applicants (the frontend also route-guards by role — see [architecture.md § Role-based routing](./architecture.md#role-based-routing-frontend)).

## Auth — `/api/auth`

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/register` | none | `{ email, password }` | Creates a `User` with role `APPLICANT`. Returns `{ accessToken, user }`. |
| POST | `/login` | none | `{ email, password }` | Returns `{ accessToken, user }`. |

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
| POST | `/me/documents` | `multipart/form-data`: `file`, `type`, `applicationId?` | `type` ∈ `ELIGIBILITY_PROOF`, `IPCR`, `DESIGNATION_ORDER`, `OTHER`. PDF/JPEG/PNG only, ≤5MB. |
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
  title?: string; positionLevel?: "ENTRY" | "PROMOTIONAL";
  qualificationEducation?: string; qualificationTraining?: string;
  qualificationExperience?: string; qualificationEligibility?: string;
  status?: "OPEN" | "CLOSED";
}
```

## Applications — `/api/applications` (all require auth)

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/` | applicant | `{ jobPostingId }` | Submits an application. Validates: profile exists, posting is open and within its 10-day window, not already applied, and — if `positionLevel === PROMOTIONAL` — an `IPCR` and `DESIGNATION_ORDER` document have been uploaded; if `hasEligibility` is true, an `ELIGIBILITY_PROOF` document has been uploaded. |
| GET | `/me` | applicant | — | Lists the caller's applications with their job posting. |
| GET | `/` | ADMIN | — | Lists applications for evaluation. Query `?jobPostingId=<uuid>` optional (unfiltered otherwise). Each entry includes the applicant's name/email and the job posting. |
| PATCH | `/:id/evaluate` | ADMIN | `EvaluateApplicationDto` | Records a score, decision, and optional remarks; sets `status` to the decision and stamps `evaluatedAt`/`evaluatedByUserId`. |

### `EvaluateApplicationDto`

```ts
{
  score: number;      // integer 0-100 (mandatory field + threshold checks per the domain spec's Eval Forms requirement)
  decision: "QUALIFIED" | "NOT_QUALIFIED";
  remarks?: string;
}
```

## Users — `/api/users` (all ADMIN only)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/` | — | Query `?role=ADMIN|APPLICANT&search=<email substring>` both optional. Never returns `passwordHash`. |
| POST | `/` | `{ email, password, role }` | Admin-provisioned account creation — the only way to create an `ADMIN` user (aside from `prisma/seed.ts`). 409 on duplicate email. |
| PATCH | `/:id` | `{ email?, role? }` | No password field — there's no admin-initiated password reset yet (see project-memory.md). |
| DELETE | `/:id` | — | 400 if you try to delete your own account. Deleting a user cascades to their `Applicant` profile (if any) and everything under it; job postings they created or applications they evaluated are kept, with the FK set to null (see [decisions.md](./decisions.md)). |

## Audit Logs — `/api/audit-logs` (ADMIN only, read-only)

| Method | Path | Notes |
|---|---|---|
| GET | `/` | Query `?entityType=User|JobPosting|Application&limit=<1-500, default 200>`. Newest first. No POST/PATCH/DELETE exist for this resource — see [decisions.md](./decisions.md) for why an audit trail has no mutation path through the API at all. |

Each entry: `{ id, action, entityType, entityId, details, createdAt, actor: { email } | null }`. `action` is a plain string (`USER_CREATED`, `USER_UPDATED`, `USER_DELETED`, `JOB_POSTING_CREATED`, `JOB_POSTING_UPDATED`, `JOB_POSTING_DELETED`, `APPLICATION_EVALUATED`), not a DB enum, so new action types don't need a migration.

## Dashboard — `/api/dashboard` (ADMIN only, read-only)

| Method | Path | Notes |
|---|---|---|
| GET | `/summary` | No query params. Aggregates counts directly from `User`/`Applicant`/`JobPosting`/`Application` (not routed through those modules' own repositories - a cross-cutting reporting read, the same pattern `AuditLogsRepository` uses) plus the 8 most recent audit log entries. |

Response shape:

```
{
  applicants: { total, registrationComplete },
  users: { total, byRole: { ADMIN, APPLICANT } },
  jobPostings: { total, byStatus: { OPEN, CLOSED } },
  applications: { total, byStatus: { SUBMITTED, UNDER_SIFTING, QUALIFIED, NOT_QUALIFIED, WITHDRAWN } },
  topJobPostings: [{ jobPostingId, title, applicationCount }],  // top 5, by application count
  recentActivity: AuditLogEntry[]  // same shape as GET /api/audit-logs, limit 8
}
```

Every status/role key is always present with a count of `0` rather than omitted - `groupBy` only returns rows for combinations that exist, so the service fills every known enum value before responding, letting the frontend render a fixed set of chart rows without a presence check per key.

## Health

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Liveness check, outside `/api`. |
