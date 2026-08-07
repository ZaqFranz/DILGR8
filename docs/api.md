# API Reference

Base URL: `http://localhost:4000/api` (configurable via `VITE_API_URL` on the frontend, `PORT` on the backend).

All error responses share this shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid request body", "details": { "...": "..." } } }
```

Authenticated routes require `Authorization: Bearer <accessToken>`.

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

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | none | Query `?status=OPEN|CLOSED` optional. Public so applicants can browse before logging in. |
| GET | `/:id` | none | |
| POST | `/` | ADMIN | Creates a posting; `closingAt` is computed server-side as `postedAt + 10 days, 23:59:59`. |

## Applications — `/api/applications` (all require auth)

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/` | `{ jobPostingId }` | Submits an application. Validates: profile exists, posting is open and within its 10-day window, not already applied, and — if `positionLevel === PROMOTIONAL` — an `IPCR` and `DESIGNATION_ORDER` document have been uploaded; if `hasEligibility` is true, an `ELIGIBILITY_PROOF` document has been uploaded. |
| GET | `/me` | — | Lists the caller's applications with their job posting. |

## Health

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Liveness check, outside `/api`. |
