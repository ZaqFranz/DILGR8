import { describe, expect, it } from "vitest";
import { combineApplicantRows } from "./combineApplicantRows";
import type { ApplicantScoreRow } from "../types";

function row(overrides: Partial<ApplicantScoreRow> & { applicationId: string; applicantId: string }): ApplicantScoreRow {
  return {
    applicantName: overrides.applicantId,
    jobPostingTitle: "Test Posting",
    jobPostingPublication: "ROS-1",
    status: "HIRED",
    perCategory: {},
    perCriterion: {},
    total: 80,
    panelistsSubmitted: 1,
    panelistsAssigned: 1,
    ...overrides,
  };
}

describe("combineApplicantRows", () => {
  it("leaves a single-posting applicant's row unchanged, with a 1-item postings list", () => {
    const combined = combineApplicantRows([row({ applicationId: "a", applicantId: "applicant-1", jobPostingTitle: "Posting A" })]);
    expect(combined).toHaveLength(1);
    expect(combined[0]!.jobPostingTitle).toBe("Posting A");
    expect(combined[0]!.postings).toEqual([{ jobPostingTitle: "Posting A", status: "HIRED" }]);
  });

  it("combines a multi-posting applicant's rows into one, joining job posting titles", () => {
    const rowA = row({ applicationId: "a", applicantId: "applicant-1", jobPostingTitle: "Posting A", status: "FOR_COMPLIANCE" });
    const rowB = row({ applicationId: "b", applicantId: "applicant-1", jobPostingTitle: "Posting B", status: "FOR_INTERVIEW" });

    const combined = combineApplicantRows([rowA, rowB]);

    expect(combined).toHaveLength(1);
    expect(combined[0]!.jobPostingTitle).toBe("Posting A, Posting B");
    expect(combined[0]!.postings).toEqual([
      { jobPostingTitle: "Posting A", status: "FOR_COMPLIANCE" },
      { jobPostingTitle: "Posting B", status: "FOR_INTERVIEW" },
    ]);
    // Score data comes from the first sibling - identical across siblings
    // by design (resolveInherited() backfills it server-side).
    expect(combined[0]!.applicationId).toBe("a");
  });

  it("keeps separate applicants as separate rows", () => {
    const combined = combineApplicantRows([
      row({ applicationId: "a", applicantId: "applicant-1" }),
      row({ applicationId: "b", applicantId: "applicant-2" }),
    ]);
    expect(combined).toHaveLength(2);
  });
});
