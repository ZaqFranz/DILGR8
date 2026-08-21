import { describe, expect, it } from "vitest";
import { findOathTakingCandidates } from "./oathTakingCandidates";
import type { AdminApplication } from "../types";

function fakeApplication(overrides: Partial<AdminApplication> & { id: string; applicantId: string }): AdminApplication {
  const { applicantId, ...rest } = overrides;
  return {
    status: "FOR_OATH_TAKING",
    submittedAt: "2026-01-01T00:00:00.000Z",
    siftingRemarks: null,
    siftedAt: null,
    examinationScore: null,
    examinationScoredAt: null,
    interviewScheduledAt: null,
    interviewScheduledEndAt: null,
    interviewVenue: null,
    interviewAttire: null,
    interviewNotes: null,
    complianceRequestedAt: null,
    complianceCompletedAt: null,
    oathTakingScheduledAt: null,
    oathTakingVenue: null,
    oathTakingNotes: null,
    hiredAt: null,
    rejectedAt: null,
    rejectionRemarks: null,
    jobPosting: { id: `posting-${overrides.id}`, title: "Posting", salaryGrade: "10" } as AdminApplication["jobPosting"],
    applicant: {
      id: applicantId,
      firstName: "Test",
      lastName: "Applicant",
      user: { email: "test@example.com" },
      educationLevel: "BACHELORS",
      yearsOfExperience: 0,
      hasEligibility: false,
      eligibilityType: "NONE",
      ldInterventions: [],
    } as AdminApplication["applicant"],
    ...rest,
  } as AdminApplication;
}

describe("findOathTakingCandidates", () => {
  it("returns an empty map when nobody has reached FOR_OATH_TAKING", () => {
    const applications = [fakeApplication({ id: "a", applicantId: "applicant-1", status: "FOR_INTERVIEW" })];
    expect(findOathTakingCandidates(applications).size).toBe(0);
  });

  it("excludes an applicant with only 1 FOR_OATH_TAKING application, even with other non-oath-taking applications", () => {
    const applications = [
      fakeApplication({ id: "a", applicantId: "applicant-1", status: "FOR_OATH_TAKING" }),
      fakeApplication({ id: "b", applicantId: "applicant-1", status: "FOR_INTERVIEW" }),
    ];
    expect(findOathTakingCandidates(applications).size).toBe(0);
  });

  it("includes an applicant with 2 FOR_OATH_TAKING applications", () => {
    const applications = [
      fakeApplication({ id: "a", applicantId: "applicant-1", status: "FOR_OATH_TAKING" }),
      fakeApplication({ id: "b", applicantId: "applicant-1", status: "FOR_OATH_TAKING" }),
    ];
    const result = findOathTakingCandidates(applications);
    expect(result.get("applicant-1")?.map((a) => a.id)).toEqual(["a", "b"]);
  });

  it("includes an applicant with 3 FOR_OATH_TAKING applications, all of them, not just the first 2", () => {
    const applications = [
      fakeApplication({ id: "a", applicantId: "applicant-1", status: "FOR_OATH_TAKING" }),
      fakeApplication({ id: "b", applicantId: "applicant-1", status: "FOR_OATH_TAKING" }),
      fakeApplication({ id: "c", applicantId: "applicant-1", status: "FOR_OATH_TAKING" }),
    ];
    const result = findOathTakingCandidates(applications);
    expect(result.get("applicant-1")?.map((a) => a.id)).toEqual(["a", "b", "c"]);
  });

  it("never ranks or picks a winner - just groups and filters", () => {
    // Regression guard for the removed highest-Salary-Grade recommendation:
    // a lower-SG application must never be dropped from the group.
    const applications = [
      fakeApplication({
        id: "low-sg",
        applicantId: "applicant-1",
        status: "FOR_OATH_TAKING",
        jobPosting: { id: "posting-low-sg", title: "Low SG", salaryGrade: "8" } as AdminApplication["jobPosting"],
      }),
      fakeApplication({
        id: "high-sg",
        applicantId: "applicant-1",
        status: "FOR_OATH_TAKING",
        jobPosting: { id: "posting-high-sg", title: "High SG", salaryGrade: "18" } as AdminApplication["jobPosting"],
      }),
    ];
    const result = findOathTakingCandidates(applications);
    expect(result.get("applicant-1")?.map((a) => a.id).sort()).toEqual(["high-sg", "low-sg"]);
  });

  it("keeps separate applicants in separate groups", () => {
    const applications = [
      fakeApplication({ id: "a", applicantId: "applicant-1", status: "FOR_OATH_TAKING" }),
      fakeApplication({ id: "b", applicantId: "applicant-1", status: "FOR_OATH_TAKING" }),
      fakeApplication({ id: "c", applicantId: "applicant-2", status: "FOR_OATH_TAKING" }),
      fakeApplication({ id: "d", applicantId: "applicant-2", status: "FOR_OATH_TAKING" }),
    ];
    const result = findOathTakingCandidates(applications);
    expect(result.size).toBe(2);
    expect(result.get("applicant-1")?.map((a) => a.id)).toEqual(["a", "b"]);
    expect(result.get("applicant-2")?.map((a) => a.id)).toEqual(["c", "d"]);
  });
});
