import { describe, expect, it } from "vitest";
import { rankRows } from "./ApplicantScoresModal";
import type { ApplicantScoreRow } from "../types";

function row(applicationId: string, total: number | null, applicantId = applicationId): ApplicantScoreRow {
  return {
    applicationId,
    applicantId,
    applicantName: applicantId,
    jobPostingTitle: "Test",
    jobPostingPublication: "ROS-1",
    status: "HIRED",
    perCategory: {},
    perCriterion: {},
    total,
    panelistsSubmitted: 1,
    panelistsAssigned: 1,
  };
}

describe("rankRows", () => {
  it("ranks distinct totals sequentially, highest first", () => {
    const ranked = rankRows([row("a", 70), row("b", 90), row("c", 80)], "overall");
    expect(ranked.find((r) => r.applicationId === "b")!.rank).toBe(1);
    expect(ranked.find((r) => r.applicationId === "c")!.rank).toBe(2);
    expect(ranked.find((r) => r.applicationId === "a")!.rank).toBe(3);
  });

  it("gives tied totals the same rank and skips the next rank accordingly (1224 competition ranking)", () => {
    const ranked = rankRows([row("a", 85), row("b", 90), row("c", 90), row("d", 70)], "overall");
    expect(ranked.find((r) => r.applicationId === "b")!.rank).toBe(1);
    expect(ranked.find((r) => r.applicationId === "c")!.rank).toBe(1);
    // The bug this regression-tests: a plain running counter would have
    // given "a" rank 2 instead of 3 here.
    expect(ranked.find((r) => r.applicationId === "a")!.rank).toBe(3);
    expect(ranked.find((r) => r.applicationId === "d")!.rank).toBe(4);
  });

  it("leaves unscored rows unranked (null) and sorts them last", () => {
    const ranked = rankRows([row("a", null), row("b", 80)], "overall");
    expect(ranked.find((r) => r.applicationId === "a")!.rank).toBeNull();
    expect(ranked.find((r) => r.applicationId === "b")!.rank).toBe(1);
  });

  it("ranks by a specific category column instead of overall when requested", () => {
    const rows: ApplicantScoreRow[] = [
      { applicationId: "a", applicantId: "a", applicantName: "a", jobPostingTitle: "Test", jobPostingPublication: "ROS-1", status: "HIRED", perCategory: { cat1: 5 }, perCriterion: {}, total: 100, panelistsSubmitted: 1, panelistsAssigned: 1 },
      { applicationId: "b", applicantId: "b", applicantName: "b", jobPostingTitle: "Test", jobPostingPublication: "ROS-1", status: "HIRED", perCategory: { cat1: 9 }, perCriterion: {}, total: 10, panelistsSubmitted: 1, panelistsAssigned: 1 },
    ];
    const ranked = rankRows(rows, "cat1");
    expect(ranked.find((r) => r.applicationId === "b")!.rank).toBe(1);
    expect(ranked.find((r) => r.applicationId === "a")!.rank).toBe(2);
  });
});
