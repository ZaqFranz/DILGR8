import { ApplicationStatus, JobPostingStatus, Role } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { APPLICATION_STATUSES, JOB_POSTING_STATUSES, USER_ROLES } from "./dashboard.dto";

// Regression test for the bug fixed 2026-08-19 (see docs/decisions.md):
// APPLICATION_STATUSES was hand-maintained and silently fell out of sync
// with the ApplicationStatus enum when Compliance to Requirements/
// Oath-Taking added 5 new statuses, so tally() (dashboard.service.ts)
// dropped every application in one of those statuses from both the
// dashboard's total and its byStatus breakdown - including HIRED. These
// assertions compare against the Prisma-generated enum itself so the same
// class of drift fails a test instead of silently under-reporting.
describe("dashboard.dto status lists stay in sync with their Prisma enums", () => {
  it("APPLICATION_STATUSES covers every ApplicationStatus value", () => {
    expect(new Set(APPLICATION_STATUSES)).toEqual(new Set(Object.values(ApplicationStatus)));
  });

  it("JOB_POSTING_STATUSES covers every JobPostingStatus value", () => {
    expect(new Set(JOB_POSTING_STATUSES)).toEqual(new Set(Object.values(JobPostingStatus)));
  });

  it("USER_ROLES covers every Role value", () => {
    expect(new Set(USER_ROLES)).toEqual(new Set(Object.values(Role)));
  });
});
