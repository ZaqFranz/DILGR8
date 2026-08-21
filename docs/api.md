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
| POST | `/register` | none | `{ email, password }` | Creates a `User` with role `APPLICANT`. `password` must satisfy `passwordPolicySchema` (see below). Returns `{ accessToken, user }`, where `user` now also carries `mustChangePassword`. |
| POST | `/login` | none | `{ email, password }` | Returns `{ accessToken, user }` (same shape as register, including `mustChangePassword`). |
| POST | `/forgot-password` | none | `{ email }` | **Applicant-only** temporary-password issuance. Always 204, regardless of whether the email matches an account, so the endpoint can't be used to enumerate registered emails - and it's a silent no-op for `ADMIN`/`PANEL` accounts, so it can't be used to force-reset one either (see [decisions.md](./decisions.md)). For a matching `APPLICANT`, generates a random 12-character temporary password (guaranteed to itself satisfy `passwordPolicySchema` below), hashes and saves it, sets `User.mustChangePassword = true`, records `AuditAction.USER_TEMPORARY_PASSWORD_ISSUED`, and emails it via the `temporaryPasswordEmail` template (`authEmailTemplates.ts`) - subject to the same `[DEV EMAIL]` console fallback as every other notification when SMTP isn't configured. |
| PATCH | `/me/password` | any authenticated role | `{ currentPassword, newPassword }` | Self-service password change - works identically for `APPLICANT`/`ADMIN`/`PANEL` since it acts on the caller's own `User` row (`req.user.id`), not a role-specific one. 400 with a `currentPassword` field error if `currentPassword` doesn't match; `newPassword` must satisfy `passwordPolicySchema` (same rule as registration). 204 on success, and always clears `mustChangePassword` (so this same endpoint is also how a temporary password gets replaced - the temp password is submitted as `currentPassword`, which has no complexity requirement of its own since it's just checked against the stored hash). Does **not** invalidate other active tokens for the same user - see [decisions.md](./decisions.md). |

**`passwordPolicySchema`** (`backend/src/shared/utils/password.ts`) - applied to every new-password field in the app (`register`'s `password`, `me/password`'s `newPassword`, and `POST /api/users`'s `password` - see [Users](#users--apiusers-all-admin-only) below), never to a `currentPassword`/login check: 8-72 characters (72 is bcrypt's own hashing limit - longer input is silently truncated by bcrypt itself, so the schema caps it rather than accepting input bcrypt would partially ignore); must include a lowercase letter, an uppercase letter, a number, and a special character; and must not be one of a small curated list of extremely common passwords (e.g. `password1`, `qwerty123`) - not a full breached-password-database check (see [decisions.md](./decisions.md)). A failing password 400s with one field-error message per broken rule (all of them, not just the first). Mirrored on the frontend as `validatePassword()`/`PASSWORD_REQUIREMENTS_HINT` (`frontend/src/shared/utils/passwordPolicy.ts`) for inline feedback before the request is even sent - the backend schema is still the authoritative check.

## Applicants — `/api/applicants` (all require auth)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/me` | — | Current user's applicant profile with relations. 404 if not created yet. |
| POST | `/me` | `CreateApplicantProfileDto` | Creates the profile (one per user; 409 if it already exists). |
| PATCH | `/me` | `Partial<CreateApplicantProfileDto>` | Updates the profile. |
| POST | `/me/complete-registration` | — | Marks the applicant as fully registered (`registrationCompletedAt`). 400 unless `PDS` and `PDS_EXCEL` documents have both been uploaded (`APPLICATION_LETTER` is *not* checked here - it's required at apply time instead, per application, since it's addressed to a specific vacancy; see `POST /applications` in [api.md § Applications](#applications--apiapplications-all-require-auth)); 400 if `hasEligibility` is true and no `ELIGIBILITY_PROOF` document has been uploaded; 400 naming the specific entry if any `LdIntervention`/`Award` row lacks a matching `LD_PROOF`/`AWARD_PROOF` document (`doc.ldInterventionId`/`doc.awardId` must reference that exact entry - one proof somewhere doesn't satisfy a different entry). Idempotent — calling it again after completion just returns the profile unchanged. The frontend gates every other applicant page on this flag (see [architecture.md § Role-based routing](./architecture.md#role-based-routing-frontend)) so no applicant data collection is deferred to after login. |
| POST | `/me/ld-interventions` | `{ title, dateAttended, numberOfHours, sponsoringAgency }` | |
| DELETE | `/me/ld-interventions/:id` | — | |
| POST | `/me/awards` | `{ title, dateAwarded, issuingBody }` | |
| DELETE | `/me/awards/:id` | — | |
| POST | `/me/documents` | `multipart/form-data`: `file`, `type`, `applicationId?`, `ldInterventionId?`, `awardId?`, `complianceItemId?` | `type` ∈ `PDS`, `PDS_EXCEL`, `IPCR`, `ELIGIBILITY_PROOF`, `LD_PROOF`, `TRANSCRIPT_OF_RECORDS`, `DIPLOMA`, `PQE_NOTICE`, `DESIGNATION_ORDER`, `AWARD_PROOF`, `COMPLIANCE_PROOF`, `OTHER` (`APPLICATION_LETTER` is *not* in this enum - it's created only via `POST /applications`, tied to the application it's submitted with, since there's no application to attach it to yet through this generic endpoint) - the rest of the official application-documents checklist (see [database.md § documents](./database.md#documents)). ≤5MB, and PDF/JPEG/PNG only *except* `PDS_EXCEL`, which must be XLSX/XLS (400 `ValidationError` otherwise - see [database.md § documents, "File type enforcement"](./database.md#documents)); `PDS` itself stays PDF/JPEG/PNG (a scanned/printed copy) - the applicant is expected to upload both the PDF and the Excel PDS as two separate documents. `ldInterventionId` (required in practice for `LD_PROOF`, but not DTO-enforced) must belong to the caller's own `LdIntervention` row or 404s; `awardId` (same, for `AWARD_PROOF`) must belong to the caller's own `Award` row or 404s; `complianceItemId` (same, for `COMPLIANCE_PROOF`) must belong to one of the caller's own `ApplicationComplianceItem` rows, and that item's application must currently be `FOR_COMPLIANCE`, or 404/400 respectively - all three are how a per-entry proof upload attaches a file to the specific claim/requirement it backs up. For every other `type`, uploading replaces any existing document of that same type for the caller (old DB row + file on disk both deleted first) rather than adding a duplicate - see [database.md § documents](./database.md#documents). |
| GET | `/me/documents` | — | Lists the caller's uploaded documents. |
| DELETE | `/me/documents/:id` | — | Deletes the DB record and the file on disk. |
| GET | `/:id/documents` | — | **ADMIN or PANEL.** Lists a specific applicant's documents by `Applicant.id` - powers the Evaluate Applicants "View Documents" modal (ADMIN) and `MyInterviewsPage`'s "View PDS" button (PANEL), so a caller can confirm what was actually submitted. 404 if no applicant with that id. For a `PANEL` caller, `DocumentsService.listForApplicant(applicantId, viewer)` filters the list down to `PDS`/`PDS_EXCEL` only and throws `ForbiddenError` (403) unless the caller is currently assigned to interview that applicant (`PanelAssignmentsRepository.isPanelUserAssignedToApplicant()` - an active `FOR_INTERVIEW` application on a posting the panelist is assigned to). `ADMIN` behavior is unchanged (full document list, no assignment check). Registered after `/me/documents` above so a literal `/me/documents` request is never swallowed by this route's wildcard `:id`. |
| GET | `/documents/:id/file` | — | **ADMIN or PANEL.** Streams a document's file bytes by `Document.id` (`Content-Type` from the stored `mimeType`, `Content-Disposition: inline` so PDF/JPEG/PNG render in the browser tab instead of forcing a download). Same `PANEL` scoping as above (`DocumentsService.getFileForViewer(...)`, renamed from `getFileForAdmin`) - 403 if the document isn't a `PDS`/`PDS_EXCEL` type or the caller isn't assigned to interview that document's applicant, checked before the existing missing-file check. 404 `Document` if no such document; 404 `Document file` if the DB row exists but the file is missing from disk (checked via `fs.access` before attempting to serve it, rather than letting a raw filesystem error reach the client) - see [decisions.md](./decisions.md) for why that check exists. |

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
  educationLevel: "ELEMENTARY" | "HIGH_SCHOOL" | "VOCATIONAL" | "COLLEGE_LEVEL" | "BACHELORS"
    | "MASTERS_LEVEL" | "MASTERS" | "DOCTORATE_LEVEL" | "DOCTORATE"; // ascending order - see database.md
  yearsOfExperience: number; // integer, 0-60
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
  numberOfVacantPositions?: string; plantillaNumbers?: string;
  salaryGrade?: "1" | "2" | ... | "33";
  placeOfAssignment?: string; positionNextInRank?: string;
  qualificationEducation?: string; qualificationTraining?: string;
  qualificationExperience?: string; qualificationEligibility?: string;
  requiredEligibilityTypes?: ("RA1080" | "CSC_PROFESSIONAL" | "CSC_SUBPROFESSIONAL" | "BARANGAY")[];
  // Structured minimums alongside the free-text qualificationX fields above -
  // optional; explicit null clears a previously-set minimum back to "no
  // automatic check" (undefined/omitted leaves it unchanged on PATCH).
  minEducationLevel?: "ELEMENTARY" | "HIGH_SCHOOL" | "VOCATIONAL" | "COLLEGE_LEVEL" | "BACHELORS"
    | "MASTERS_LEVEL" | "MASTERS" | "DOCTORATE_LEVEL" | "DOCTORATE" | null;
  minYearsExperience?: number | null;  // integer, 0-60
  minTrainingHours?: number | null;    // integer, 0-10000
  duties?: string;
  status?: "OPEN" | "CLOSED";
}
```

`CreateJobPostingDto` is the same shape with every field (except `status`, which isn't settable on create) required rather than optional, `requiredEligibilityTypes` defaulting to `[]` if omitted, and `minEducationLevel`/`minYearsExperience`/`minTrainingHours` plain optional (no `null` variant - a posting is either created with a minimum or without one).

`minEducationLevel`/`minYearsExperience`/`minTrainingHours` are optional structured minimums that enable an automatic "meets/below/no automatic check" hint on `EvaluateApplicantsPage`'s Sift modal, computed client-side against the applicant's `educationLevel`/`yearsOfExperience`/summed `LdIntervention.numberOfHours` (see `qualificationMatch.ts` and [decisions.md](./decisions.md)) - not returned as a separate field by any endpoint, just derived from data both `GET /api/applications` (below) and this response already carry. They never replace `qualificationEducation`/`qualificationExperience`/`qualificationTraining` as the authoritative QS wording. `description` is free-text role/duties overview, distinct from the four `qualification*` fields (which are the formal QS requirements) — it's what the applicant-facing "View Details" modal on `JobPostingsListPage` leads with. `numberOfVacantPositions`, `plantillaNumbers`, `placeOfAssignment`, `positionNextInRank`, and `duties` are all free-text (not numeric/structured) so they can carry values formatted exactly as the official DILG job-posting document prints them (e.g. `numberOfVacantPositions: "One (1)"`) rather than the app imposing its own format; `duties` is expected as one duty per line — the frontend splits on `\n` to render it as a numbered list. There is no "position level" (Entry/Promotional) field - it was removed (see [decisions.md](./decisions.md)) since nothing in the app branched on it and it doesn't appear on the official posting document these fields now mirror.

**`salaryGrade` is a closed set of 33 string values (`"1"`-`"33"`), not free text.** `monthlySalary` is deliberately absent from both DTOs above — it's never admin-typed. `JobPostingsService` derives and overwrites it on every create/update by looking `salaryGrade` up in `SALARY_GRADE_MONTHLY_SALARY` (`backend/src/shared/constants/salaryGrades.ts`, the official DBM Salary Grade schedule - currently EO 64/SSL VI's Third Tranche, effective January 1, 2026), formats it (`"₱31,705.00"`), and stores that on `monthlySalary`. The response body still includes `monthlySalary` as always — only the *input* changed. See [decisions.md](./decisions.md)'s 2026-08-12 "Fixed Monthly Salary derived from Salary Grade" entry.

`requiredEligibilityTypes` is the machine-enforced eligibility gate, separate from the free-text `qualificationEligibility` field: an empty array (the default) means no eligibility is required to apply; a non-empty array is checked against the applicant's own `eligibilityType` at submission time (see `POST /api/applications` below) and — on the frontend — disables the "Apply" button up front with an explanatory message rather than letting the applicant find out only after submitting. Stored via the `job_posting_required_eligibilities` join table (see [database.md](./database.md)), flattened to this array on every response.

## Applications — `/api/applications` (all require auth)

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/` | applicant | `multipart/form-data`: `jobPostingId`, `file` | Submits an application. `file` is the Application Letter (PDF/JPEG/PNG, ≤5MB) - required (400 without one), since it's addressed to this specific vacancy rather than collected once at registration; stored as a `Document(type=APPLICATION_LETTER, applicationId=<new application's id>)`, created in the same DB transaction as the `Application` itself (`ApplicationsRepository.createWithApplicationLetter()`). Validates: profile exists, applicant has no `HIRED` application anywhere yet (409, added 2026-08-21 - "as long as Applicant is not hired" applies system-wide, not per posting), posting is open and within its 10-day window, not already applied to this specific posting. If the posting has any `requiredEligibilityTypes`, 400s unless the applicant has `hasEligibility: true` **and** `eligibilityType` is one of them (message lists the accepted types); separately, if `hasEligibility` is true, an `ELIGIBILITY_PROOF` document must have been uploaded regardless of whether the posting requires eligibility. `DESIGNATION_ORDER`/`IPCR` are collected once at registration (optional, per the official documents checklist) rather than gated per application - there's no posting-level distinction (e.g. a former "promotional" flag) that changes document requirements at submission time, see [decisions.md](./decisions.md). Being `multipart/form-data`, this route uses `uploadApplicationLetter` (multer) instead of the `validate()` middleware - `ApplicationsController.submit` parses `jobPostingId` with `createApplicationSchema.safeParse()` itself, same pattern as `POST /import-exam-scores` below. |
| GET | `/me` | applicant | — | Lists the caller's applications with their job posting. |
| GET | `/` | ADMIN | — | Lists applications for evaluation. Query `?jobPostingId=<uuid>` optional (unfiltered otherwise). Each entry includes the applicant's name/email/`educationLevel`/`yearsOfExperience`/`hasEligibility`/`eligibilityType`/`ldInterventions` and the job posting incl. `minEducationLevel`/`minYearsExperience`/`minTrainingHours`/`requiredEligibilityTypes` - enough for the frontend to compute the Sifting qualification-match hint client-side (see `UpdateJobPostingDto` above and [decisions.md](./decisions.md)) without a second request. |
| PATCH | `/:id/sift` | ADMIN | `SiftApplicationDto` | The Sifting phase's pass/fail call against the posting's qualification standards (education/training/experience/eligibility). Sets `status` to the decision and stamps `siftedAt`/`siftedByUserId`/`siftingRemarks`. 400 unless current status is `UNDER_SIFTING` (every application starts there automatically on submit - see below). |
| POST | `/import-exam-scores` | ADMIN | multipart: `file` (`.xlsx`/`.xls`) + `jobPostingId` | Imports Pre-Qualifying Examination (PQE) scores, conducted outside the system. Expects a header row with "Name"/"Score" columns; each row is matched against that posting's `QUALIFIED` applicants by trying several normalized name forms per applicant (`firstName lastName`, plus `firstName middleName lastName` and `firstName middleInitial. lastName` when a middle name is on file, each optionally with `suffix` appended) — case/whitespace/period-insensitive, so "Gibo R. Ormeneta" matches an applicant on file as firstName "Gibo", middleName "R.", lastName "Ormeneta" just as well as plain "Gibo Ormeneta" does. On match, sets `examinationScore`/`examinationScoredAt`. Returns `{ matched: [{applicationId, applicantName, score}], unmatched: [{name, score}] }` — non-matches aren't an error, the admin reviews and can fix names and re-upload. |
| PATCH | `/:id/exam-score` | ADMIN | `{ score: number }` (integer, 0–100) | Manual, single-application alternative to the bulk import above - same fields (`examinationScore`/`examinationScoredAt`), same `examScoreEmail` notification, same audit trail (a distinct `APPLICATION_EXAM_SCORE_SET` action, not `APPLICATION_EXAM_SCORES_IMPORTED`), just for one application at a time instead of requiring a spreadsheet. 400 unless the application is currently `QUALIFIED` (same pipeline-order rule the bulk import already enforces implicitly by only matching `QUALIFIED` applicants) - "Cannot record a PQE score unless the application is Qualified (sifting must pass first)". |
| PATCH | `/:id/schedule-interview` | ADMIN | `ScheduleInterviewDto` | Moves the application into the interview stage (`status: FOR_INTERVIEW`), making it visible to assigned panelists' `GET /panel-evaluations/my-queue`. 400 unless `status === "QUALIFIED"` **and** `examinationScore` is recorded — sifting and the PQE score must both be done first. 400 if `scheduledAt` isn't in the future. Stamps `interviewScheduledAt`/`interviewVenue`/`interviewAttire`/`interviewNotes`, all of which are rendered into the notification email so the applicant actually knows when/where to show up and what to wear, rather than a vague "the panel will be in touch." |
| PATCH | `/:id/withdraw` | applicant | — | Applicant-initiated withdrawal of their own application. 404 if the application doesn't exist or doesn't belong to the caller (an applicant can't distinguish the two cases). 400 unless current status is `SUBMITTED`/`UNDER_SIFTING`/`QUALIFIED`/`FOR_INTERVIEW`/`FOR_COMPLIANCE`/`FOR_OATH_TAKING` — `NOT_QUALIFIED`, `NOT_SELECTED`, `DISQUALIFIED`, `HIRED`, and `WITHDRAWN` itself are all terminal and can't be withdrawn. Sets `status: WITHDRAWN` and stamps `withdrawnAt`. |
| GET | `/:id/compliance-items` | any authenticated role | — | The application's Compliance to Requirements checklist: `[{ id, status, submissionType, remarks, reviewedAt, requirement: { id, name, description }, documents: Document[] }]`. An `APPLICANT` caller may only read their own application's checklist (404 otherwise, same "can't distinguish doesn't-exist from isn't-yours" shape as withdraw); an `ADMIN` caller may read any application's. Powers both the admin `ComplianceReviewModal` and the applicant's `ComplianceChecklistSection`. |
| PATCH | `/:id/move-to-compliance` | ADMIN | — | The RD's decision to advance this applicant past Evaluation - there's no separate "Deliberation" status (see [decisions.md](./decisions.md)), this endpoint *is* that judgment call. 400 unless `status === "FOR_INTERVIEW"`. Sets `status: FOR_COMPLIANCE`, stamps `complianceRequestedAt`, and snapshots one `PENDING`, `SOFTCOPY` `ApplicationComplianceItem` per currently-active `ComplianceRequirement` (a requirement added to the catalog afterward won't retroactively appear on an already-in-progress applicant's checklist). |
| PATCH | `/:id/not-selected` | ADMIN | `RejectApplicationDto` (`{ remarks? }`) | The regret outcome when an applicant doesn't advance past the panel evaluation - the only other exit from `FOR_INTERVIEW` besides `move-to-compliance`. 400 unless `status === "FOR_INTERVIEW"`. Sets `status: NOT_SELECTED`, stamps `rejectedAt`/`rejectionRemarks`, and sends `regretEmail()` (the same "regret letter" template `sift`'s `NOT_QUALIFIED` branch uses, worded for this stage). See [decisions.md](./decisions.md). |
| POST | `/:id/compliance-items` | ADMIN | `AddComplianceItemDto` (`{ requirementId, submissionType? }`) | Manually attaches one requirement from the Compliance Requirements catalog to this application's checklist, on top of whatever `move-to-compliance` snapshotted automatically. Exists so an admin isn't stuck when that snapshot came up short or empty (e.g. the catalog had no active requirements at the moment the applicant moved to Compliance) — the admin picks the requirement here instead. `submissionType` defaults to `SOFTCOPY` when omitted. 400 unless `status === "FOR_COMPLIANCE"`. 404 if the requirement doesn't exist. 409 if this requirement is already on the applicant's checklist. Creates a `PENDING` item, same shape as the automatic snapshot. |
| PATCH | `/:id/compliance-items/:itemId/submission-type` | ADMIN | `SetComplianceItemSubmissionTypeDto` (`{ submissionType }`) | Declares how one checklist item is expected to reach the admin - `SOFTCOPY` (the online `COMPLIANCE_PROOF` upload) or `HARDCOPY` (a physical copy handed over outside the system). This is what the review endpoint below checks before allowing `VERIFIED`. 404 if the item doesn't belong to `:id`. |
| PATCH | `/:id/compliance-items/:itemId` | ADMIN | `ReviewComplianceItemDto` | Verifies or rejects one requirement, whether it came from the automatic snapshot or was added manually via `POST /:id/compliance-items` above. `VERIFIED` requires both the applicant's submission and the admin's approval, never the admin's judgment alone: for a `SOFTCOPY` item (the default), 400 if no `COMPLIANCE_PROOF` document has been uploaded yet — "nothing to verify" — the response names the item and suggests switching it to `HARDCOPY` if it was actually submitted physically. A `HARDCOPY` item has no online counterpart to check, so the admin's `VERIFIED` here *is* the record that the physical copy was received and approved. `REJECTED` carries no such precondition either way - an admin can reject a requirement that was never submitted at all (e.g. past deadline). 404 if the item doesn't belong to `:id`. Stamps `status`/`remarks`/`reviewedAt`/`reviewedByUserId`. |
| PATCH | `/:id/oath-taking` | ADMIN | `ScheduleOathTakingDto` | Bundles the `FOR_COMPLIANCE` → `FOR_OATH_TAKING` transition with the ceremony's schedule, the same "one action" shape `schedule-interview` uses. 400 unless `status === "FOR_COMPLIANCE"` **and** every compliance item is `VERIFIED`; 400 if `scheduledAt` isn't in the future. Stamps `complianceCompletedAt`/`oathTakingScheduledAt`/`oathTakingVenue`/`oathTakingNotes`. |
| PATCH | `/:id/disqualify` | ADMIN | `RejectApplicationDto` (`{ remarks? }`) | The regret outcome when an applicant doesn't complete Compliance to Requirements - the only other exit from `FOR_COMPLIANCE` besides `oath-taking`. Unlike `oath-taking`, this carries no "every item verified" precondition - an admin can disqualify at any point during Compliance. 400 unless `status === "FOR_COMPLIANCE"`. Sets `status: DISQUALIFIED`, stamps `rejectedAt`/`rejectionRemarks`, and sends the same `regretEmail()`, worded for this stage. See [decisions.md](./decisions.md). |
| PATCH | `/:id/hire` | ADMIN | — | Marks the oath-taking ceremony completed. 400 unless `status === "FOR_OATH_TAKING"`. Sets `status: HIRED` and stamps `hiredAt` - terminal for this pipeline segment; Onboarding itself (videos, pre/post evaluations) is future work. |

`POST /`, `PATCH /:id/sift`, `POST /import-exam-scores`, `PATCH /:id/exam-score`, `PATCH /:id/schedule-interview`, `PATCH /:id/withdraw`, `PATCH /:id/move-to-compliance`, `PATCH /:id/oath-taking`, and `PATCH /:id/hire` each email the applicant after their write succeeds (application received / sifted qualified-or-not / PQE score recorded / scheduled for interview / withdrawn / compliance requirements requested / oath-taking invitation / hired, respectively), via `EmailService` (`backend/src/shared/email/emailService.ts`). Real sending requires `SMTP_HOST` (+ optional `SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`/`SMTP_SECURE`/`SMTP_FROM`) in `backend/.env`; with `SMTP_HOST` unset (the default - see `.env.example`), the email is logged to the console prefixed `[DEV EMAIL]` instead of sent, so this is fully testable without a mail server. Either path: a send failure is logged, never thrown - none of these endpoints fail because a notification couldn't go out.

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

### `AddComplianceItemDto`

```ts
{
  requirementId: string; // uuid, must exist in the Compliance Requirements catalog
  submissionType?: "SOFTCOPY" | "HARDCOPY"; // defaults to SOFTCOPY (the schema default) when omitted
}
```

### `SetComplianceItemSubmissionTypeDto`

```ts
{
  submissionType: "SOFTCOPY" | "HARDCOPY";
}
```

### `ReviewComplianceItemDto`

```ts
{
  status: "VERIFIED" | "REJECTED";
  remarks?: string;
}
```

### `ScheduleOathTakingDto`

```ts
{
  scheduledAt: string; // ISO datetime, must be in the future
  venue: string;
  notes?: string;
}
```

## Compliance Requirements — `/api/compliance-requirements` (all ADMIN only)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/` | — | The full CSC-mandated documentary checklist catalog (both active and inactive - there's no `PANEL`-facing "active only" caller here, unlike `categories`, since applicants read their own checklist via `GET /applications/:id/compliance-items` instead). |
| POST | `/` | `{ name, description?, sortOrder? }` | Adds a requirement to the catalog. |
| PATCH | `/:id` | `{ name?, description?, sortOrder?, isActive? }` | `isActive: false` retires a requirement without deleting it. |
| DELETE | `/:id` | — | 409 if any `ApplicationComplianceItem` references it — deactivate it instead so past applicant submissions stay intact. |

Adding, editing, or deleting a requirement here never touches applications already `FOR_COMPLIANCE` or later - `moveToCompliance` only snapshots the *currently*-active catalog at the moment an applicant enters that phase (see [database.md § application_compliance_items](./database.md#application_compliance_items)).

## Users — `/api/users` (all ADMIN only)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/` | — | Query `?role=ADMIN|APPLICANT|PANEL&search=<email substring>` both optional. Never returns `passwordHash`. |
| POST | `/` | `{ email, password, role }` | Admin-provisioned account creation — the only way to create an `ADMIN` or `PANEL` user (aside from `prisma/seed.ts`). 409 on duplicate email. |
| PATCH | `/:id` | `{ email?, role? }` | No password field — password changes go through `POST /:id/reset-password` below (self-service change is `PATCH /api/auth/me/password` instead). |
| DELETE | `/:id` | — | 400 if you try to delete your own account. Deleting a user cascades to their `Applicant` profile (if any) and everything under it; job postings they created or applications they evaluated are kept, with the FK set to null (see [decisions.md](./decisions.md)). |
| POST | `/:id/reset-password` | — | Admin-initiated counterpart to `POST /api/auth/forgot-password` (which is `APPLICANT`-only self-service) — issues a fresh temporary password for *any* role, emails it to the target, and sets `mustChangePassword`, invalidating whatever password they had immediately. 404 if the user doesn't exist. No self-delete-style guard on resetting your own password — doing it to yourself is harmless (the current session stays valid; only the next login needs the emailed temporary password). |

## Audit Logs — `/api/audit-logs` (ADMIN only, read-only)

| Method | Path | Notes |
|---|---|---|
| GET | `/` | Query `?entityType=User|JobPosting|Application&search=<text>&limit=<1-500, default 200>`. Newest first. `search` is matched (case-insensitive `contains`) against `action`, `details`, and the actor's email, applied in the WHERE clause before `limit` truncates - so it can surface an old entry `limit`'s most-recent-N window would otherwise cut off, which is the point of searching a long-running audit trail. No POST/PATCH/DELETE exist for this resource — see [decisions.md](./decisions.md) for why an audit trail has no mutation path through the API at all. |

Each entry: `{ id, action, entityType, entityId, details, createdAt, actor: { email } | null }`. `action` is a plain string (`USER_CREATED`, `USER_UPDATED`, `USER_DELETED`, `JOB_POSTING_CREATED`, `JOB_POSTING_UPDATED`, `JOB_POSTING_DELETED`, `APPLICATION_SIFTED`, `APPLICATION_EXAM_SCORES_IMPORTED`, `APPLICATION_SCHEDULED_INTERVIEW`, `APPLICATION_MOVED_TO_COMPLIANCE`, `APPLICATION_COMPLIANCE_ITEM_REVIEWED`, `APPLICATION_OATH_TAKING_SCHEDULED`, `APPLICATION_HIRED`, `CRITERION_CREATED`, `CRITERION_UPDATED`, `CRITERION_DELETED`, `COMPLIANCE_REQUIREMENT_CREATED`, `COMPLIANCE_REQUIREMENT_UPDATED`, `COMPLIANCE_REQUIREMENT_DELETED`, `PANEL_ASSIGNED`, `PANEL_UNASSIGNED`, `PANEL_EVALUATION_SUBMITTED`), not a DB enum, so new action types don't need a migration.

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
  applications: { total, byStatus: { SUBMITTED, UNDER_SIFTING, FOR_INTERVIEW, QUALIFIED, NOT_QUALIFIED, FOR_COMPLIANCE, NOT_SELECTED, DISQUALIFIED, FOR_OATH_TAKING, HIRED, WITHDRAWN } },
  topJobPostings: [{ jobPostingId, title, applicationCount }],  // top 5, by application count
  recentActivity: AuditLogEntry[]  // same shape as GET /api/audit-logs, limit 8
}
```

Every status/role key is always present with a count of `0` rather than omitted - `groupBy` only returns rows for combinations that exist, so the service fills every known enum value (`APPLICATION_STATUSES`/`JOB_POSTING_STATUSES`/`USER_ROLES`, `dashboard.dto.ts`) before responding, letting the frontend render a fixed set of chart rows without a presence check per key. These lists are hand-maintained, not derived from the Prisma enums at compile time - `dashboard.dto.test.ts` guards against them drifting out of sync again (see [decisions.md](./decisions.md)'s 2026-08-19 entry: `APPLICATION_STATUSES` previously omitted `FOR_COMPLIANCE`/`NOT_SELECTED`/`DISQUALIFIED`/`FOR_OATH_TAKING`/`HIRED`, silently excluding every application in one of those 5 statuses from both `applications.total` and `byStatus`).

## Categories — `/api/categories` (was `/api/evaluation-criteria`, renamed 2026-08-19 - see `docs/decisions.md`)

The interview rubric, two levels deep: a **Category** (e.g. "Communication Skills") groups any number of **Criteria/Questions** - the actual scored line items, each with its own `maxScore`. A panelist scores every criterion individually; a category is never scored directly, only reported as the sum of its own criteria (see Panel Evaluations below).

A category also carries its own **`weightPercent`** - its admin-set, authoritative share of the overall evaluation (e.g. `25` = 25%), added 2026-08-19 per client request ("even I have many criteria max point should still be 25% of the overall evaluation"). This is deliberately independent of `maxScore`: a category worth 25% contributes exactly 25% to the overall score no matter how many criteria it has or what their raw points sum to - see `GET /panel-evaluations/applicant-scores` and `PATCH /panel-evaluations/:applicationId` below for how a panelist's raw scores get normalized against it.

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| GET | `/` | ADMIN or PANEL | — | The interview rubric, each category with its nested `criteria: Criterion[]`, its own `weightPercent`, and a computed `maxScore` (the sum of its own *active* criteria's `maxScore` - not a stored column, so it can never drift out of sync with its own children; this is the **raw** internal grading scale, not the category's real weight). `PANEL` callers only get `isActive` categories, and only `isActive` criteria within them (what they need to render a scoring form); `ADMIN` sees inactive ones too so they can be reactivated. |
| POST | `/` | ADMIN | `{ name, weightPercent, criteria?: CriterionInputDto[], sortOrder? }` | Adds a category. `weightPercent` is required (1-100). |
| PATCH | `/:id` | ADMIN | `{ name?, weightPercent?, criteria?: CriterionInputDto[], sortOrder?, isActive? }` | `isActive: false` retires a category without deleting it. When `criteria` is present, it's **diffed** against what's on file rather than blindly replaced: an entry with an `id` updates that row in place, one without an `id` creates a new row, and any existing criterion missing from the array is removed - *unless* it already has recorded `PanelScore`s, in which case the whole update 409s, naming the criterion and directing the admin to set its own `isActive: false` instead of omitting it. |
| DELETE | `/:id` | ADMIN | — | 409 if any of the category's criteria has a recorded `PanelScore` — deactivate the category instead so past scores stay intact. Deleting an unscored category cascades to its (unscored) criteria. |

The app never validates that active categories' `weightPercent` values sum to 100 - the Add/Edit Category form shows a soft "Active categories would total N% with this value" hint (only a warning past/under 100, not a blocking error) since it's on the admin to keep weights meaningful together.

### `CriterionInputDto`

```ts
{
  id?: string; // present = update this existing criterion; absent = create a new one
  name: string;
  maxScore: number;
  sortOrder?: number;
  isActive?: boolean; // defaults true for a new criterion; kept as-is on update if omitted
}
```

## Interview Panel Assignments — `/api/panel-assignments` (all ADMIN only)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/` | — | Query `?jobPostingId=<uuid>` optional. Each entry includes the assigned panelist's `{ id, email }`. |
| POST | `/` | `{ jobPostingId, panelUserId }` | Assigns a `PANEL`-role user to a posting's interview board. 400 if `panelUserId` isn't role `PANEL`; 409 if already assigned to that posting. |
| POST | `/bulk` | `{ jobPostingIds: string[], panelUserIds: string[] }` (max 200 × 50) | Assigns every listed panelist to every listed posting's board in one call — the Interview Panel page's "select multiple applicants, assign a panel to all of them" bulk action, resolved to postings since that's what `PanelAssignment` is keyed on. Add-only: pairs already assigned are silently skipped, never removed. 404 if any posting/panel-user id doesn't exist; 400 if any `panelUserId` isn't role `PANEL`. Returns `{ created: PanelAssignmentWithPanelUser[], skippedCount: number }`. See `docs/decisions.md`'s 2026-08-11 entry. |
| DELETE | `/:id` | — | Unassigns. Any scores that panelist already submitted for that posting's applications are kept. |

## Applicant Groups — `/api/applicant-groups` (all ADMIN only)

Ad hoc groupings of applicants for Group Dynamics Evaluation - not part of `docs/rsp-domain-spec.md`, and unrelated to the interview rubric (Categories) or `panel-assignments` above. A group carries no `jobPostingId` — membership is a set of `Application` ids, which may span different postings.

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/` | — | Every group, each with its `members[]` (`{ id, applicationId, application: { id, jobPosting: { id, title }, applicant: { id, firstName, lastName, user: { email } } } }`). |
| POST | `/` | `{ name, description?, applicationIds: string[] }` (2-100 ids) | Creates a group from the given applications — the "Group" button on `GroupsPage`'s bulk action bar, taking the place of Interview Panel's panel-member picker. 400 if fewer than 2 ids given (a group of one isn't a group) or any application id doesn't exist. |
| PATCH | `/:id` | `{ name?, description?, applicationIds?: string[] }` (2-100 ids if given) | Renames/redescribes a group and/or replaces its membership. `applicationIds`, when present, is the group's new full member list — diffed against what's on file (remove what's missing, add what's new) rather than an add/remove delta. Backs `GroupsPage`'s "Members" action, which seeds the applicant table's checkbox selection with the group's current members so the admin edits it with the same checkboxes used to create a group. 404 if the group doesn't exist; 400 if `applicationIds` has fewer than 2 entries or any id doesn't exist. |
| DELETE | `/:id` | — | Deletes the group and cascade-deletes its members. No usage guard (unlike Categories/Compliance Requirements) — a group has no historical scores or other rows referencing it. |

## Panel Evaluations — `/api/panel-evaluations`

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| GET | `/my-queue` | PANEL | — | Applications with `status: FOR_INTERVIEW` across every posting the caller is assigned to, each including the caller's own existing evaluation (if any) so the frontend can pre-fill an in-progress form. Each entry's `applicant` now also includes `id` (previously only `firstName`/`lastName`) so the frontend can pass it into `GET /applicants/:id/documents` for the "View PDS" button. Excludes any application whose `scoreSourceApplicationId` is set (added 2026-08-21) - it already has an effective score inherited from another of the applicant's applications, so no panelist is ever asked to score it again. |
| PATCH | `/:applicationId` | PANEL | `{ remarks?, scores: [{ criterionId, score }] }` | Upserts the caller's own evaluation for that application (one per panelist per application — re-submitting overwrites, mirroring `applications.sift`'s upsert-on-resubmit pattern). `criterionId` here is a **Criterion** (the leaf) id, not a Category id - a panelist scores every individual criterion on its own **raw** scale (0 to that criterion's `maxScore`), never a category as one number; how those raw scores translate into the category's actual weighted contribution happens downstream (see "Weighted scoring" below), not at submission time. 400 if the application isn't `FOR_INTERVIEW`, its `examinationScore` is still `null` (PQE score not yet recorded — see below), its `scoreSourceApplicationId` is already set (added 2026-08-21 - this application's score is carried over from another of the applicant's applications; scoring it directly isn't allowed, and it never appears in `GET /my-queue` in the first place, see below), a score is missing for any active criterion (message names it as `"<Category name> - <Criterion name>"`), or a score exceeds that criterion's own `maxScore` (the spec's mandatory-field + threshold rules); 403 if the caller isn't assigned to that application's posting. On success, propagates the new score to every other of the applicant's open applications that don't already have their own evaluation or an existing score source (`PanelEvaluationsRepository.linkSiblingScoreSources()`), so a multi-posting applicant is only ever interviewed once. |
| GET | `/tabulation/:jobPostingId` | ADMIN | — | The CompAss ranked matrix for a posting: every assigned panelist, and per application (`FOR_INTERVIEW`/`QUALIFIED`/`NOT_QUALIFIED`) each panelist's **weighted** total score (see "Weighted scoring" below - not a flat raw sum), the average across panelists who've submitted, a descending rank, and `panelistsSubmitted`/`panelistsAssigned` counts (drives the "N of M haven't scored yet" warning `EvaluateApplicantsPage` shows before an admin finalizes early). A missing panelist only shrinks the averaging denominator - it never blocks the average from being computed. An application with no evaluations of its own but a `scoreSourceApplicationId` (added 2026-08-21) shows the inherited application's scores here too - resolved server-side via a batched lookup, transparent to this endpoint's shape. |
| GET | `/applicant-scores` | ADMIN | — | Source for both the Categories page's "Applicant Scores" modal and the admin **Report Summary** page (`/admin/report-summary`, added 2026-08-21): every application **across all job postings and every status** that has at least one submitted `PanelEvaluation`, **or** whose score is inherited from another of the same applicant's applications via `scoreSourceApplicationId` (added 2026-08-21 - unscored applications are still excluded, but an inheriting one has an effective score even with zero `PanelEvaluation` rows of its own, resolved the same batched way `/tabulation/:jobPostingId` does). The status filter that used to restrict this to `FOR_INTERVIEW`/`QUALIFIED`/`NOT_QUALIFIED` was dropped 2026-08-21 - a scored application that's since moved on to Compliance, Oath-Taking, HIRED, or even NOT_SELECTED/DISQUALIFIED/WITHDRAWN is still a historical fact worth showing here, and Report Summary's own Status column + filter let the admin narrow it back down client-side. Unlike `/tabulation/:jobPostingId`, this is not scoped to one posting, and unlike that endpoint it never breaks a result down by individual panelist - everything here is already combined. Returns `{ categories: [{ id, name, weightPercent }], criteria: [{ id, categoryId, name, maxScore }], rows: [{ applicationId, applicantName, jobPostingTitle, jobPostingPublication, status, perCategory: Record<categoryId, number \| null>, perCriterion: Record<criterionId, number \| null>, total: number \| null, panelistsSubmitted, panelistsAssigned }] }` — `jobPostingPublication` (added 2026-08-21) is the job posting's recruitment publication round/batch (`JobPosting.publication`, e.g. "ROS-1"), included so Report Summary's Publication filter can narrow the table the same way `EvaluateApplicantsPage`'s own Publication filter narrows its applicant list. — `perCategory` is, per application, each panelist's **weighted** contribution for that category (their raw subtotal across the category's own criteria, normalized to `weightPercent` - see below), then averaged across every panelist who scored the application; `perCriterion` (for Report Summary's per-criterion columns) is each panelist's **raw** score (0-`maxScore`, no weighting - a criterion has no weight of its own) for that one criterion, averaged the same way; `total` is the same averaging over each panelist's full weighted grand total. All computed against every currently-active category/criterion. `panelistsAssigned` (added 2026-08-21 for Report Summary's "submitted/assigned" figure) is looked up per-row via that application's own `jobPostingId` against every `PanelAssignment` in one query, since unlike `/tabulation/:jobPostingId` this endpoint spans every posting rather than having one fixed assigned-panelist count for the whole response. `categories[].weightPercent` (not `maxScore`) is the ceiling the `perCategory` numbers can reach, so that's what column headers should show; `criteria[].maxScore` is the equivalent ceiling for `perCriterion`. Rows are returned unranked/unsorted — ranking by a chosen column (overall total or one specific category) is done client-side in `ApplicantScoresModal`, since which column to rank by is an interactive display choice, not fixed data (Report Summary doesn't rank at all, it's a report, not a leaderboard - one row per applicant, one column per category and per criterion, no expand/collapse or prose breakdown, just the table). |

### Weighted scoring

A category is worth exactly its own `weightPercent` of the overall evaluation, independent of how many criteria it has or what their raw points sum to (client requirement: "even I have many criteria max point should still be 25% of the overall evaluation"). For one panelist's evaluation: a category's **raw subtotal** (the sum of that panelist's scores across just the category's own criteria) is normalized against the category's **raw max** (`category.maxScore`, the sum of its active criteria's own `maxScore`) and scaled to `weightPercent`:

```
weightedCategoryScore = rawMax > 0 ? (rawSubtotal / rawMax) * weightPercent : 0
```

A panelist's overall score for an application is the sum of every category's weighted contribution - never a flat sum of raw `PanelScore` rows. A category with no active criteria (nothing to normalize against) contributes 0 regardless of its weight. Both `GET /tabulation/:jobPostingId` and `GET /applicant-scores` above use this; see `backend/src/modules/panel-evaluations/panel-evaluations.service.ts`'s `weightedCategoryScore()`/`weightedTotalScore()` (both exported and unit-tested, `panel-evaluations.service.test.ts`) for the implementation.

`applications.scheduleInterview()` already refuses to move an application into `FOR_INTERVIEW` without a recorded `examinationScore`, so a PQE-less application shouldn't reach the panel queue in the first place. `panel-evaluations.submit()`'s own `examinationScore === null` check is a second, independent gate on the same rule — kept so panel scoring never silently depends on that earlier gate holding. `GET /my-queue` and `InterviewQueueApplication` expose `examinationScore` so `MyInterviewsPage` shows a "PQE score" column and disables the Score/Update scores button (with an inline explanation) for any row where it's still `null`.

## Health

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Liveness check, outside `/api`. |
