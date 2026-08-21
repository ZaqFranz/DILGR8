import { describe, expect, it } from "vitest";
import { computeHireRecommendations } from "./hireRecommendation";
import type { AdminApplication, ApplicationStatus } from "../types";

// Only the fields computeHireRecommendations actually reads (status,
// applicant.id, jobPosting.salaryGrade, id) are meaningful here - the rest
// of AdminApplication's large shape is irrelevant to this pure function, so
// this fixture stays narrow rather than fully typed.
function fakeApplication(id: string, applicantId: string, status: ApplicationStatus, salaryGrade: string): AdminApplication {
  return {
    id,
    status,
    applicant: { id: applicantId } as AdminApplication["applicant"],
    jobPosting: { salaryGrade } as AdminApplication["jobPosting"],
  } as AdminApplication;
}

describe("computeHireRecommendations", () => {
  it("returns an empty map when no applicant has 2+ FOR_OATH_TAKING applications", () => {
    const applications = [
      fakeApplication("a", "applicant-1", "FOR_OATH_TAKING", "10"),
      fakeApplication("b", "applicant-2", "FOR_OATH_TAKING", "12"),
      fakeApplication("c", "applicant-1", "QUALIFIED", "15"),
    ];
    expect(computeHireRecommendations(applications).size).toBe(0);
  });

  it("picks the higher salary grade correctly across one- and two-digit grades", () => {
    // Regression test: "9" > "10" as strings, but 9 < 10 numerically -
    // parseInt() must be used, not a plain string comparison.
    const applications = [
      fakeApplication("a", "applicant-1", "FOR_OATH_TAKING", "9"),
      fakeApplication("b", "applicant-1", "FOR_OATH_TAKING", "10"),
    ];
    const recommendations = computeHireRecommendations(applications);
    expect(recommendations.get("applicant-1")).toEqual({
      recommendedApplicationId: "b",
      otherApplicationIds: ["a"],
    });
  });

  it("with 3+ applications, otherApplicationIds contains every one but the recommended", () => {
    const applications = [
      fakeApplication("a", "applicant-1", "FOR_OATH_TAKING", "10"),
      fakeApplication("b", "applicant-1", "FOR_OATH_TAKING", "22"),
      fakeApplication("c", "applicant-1", "FOR_OATH_TAKING", "15"),
    ];
    const recommendations = computeHireRecommendations(applications);
    expect(recommendations.get("applicant-1")?.recommendedApplicationId).toBe("b");
    expect(recommendations.get("applicant-1")?.otherApplicationIds.sort()).toEqual(["a", "c"]);
  });

  it("resolves a tie by keeping the first one encountered", () => {
    const applications = [
      fakeApplication("a", "applicant-1", "FOR_OATH_TAKING", "10"),
      fakeApplication("b", "applicant-1", "FOR_OATH_TAKING", "10"),
    ];
    const recommendations = computeHireRecommendations(applications);
    expect(recommendations.get("applicant-1")?.recommendedApplicationId).toBe("a");
  });

  it("ignores applications for other applicants when deciding one applicant's recommendation", () => {
    const applications = [
      fakeApplication("a", "applicant-1", "FOR_OATH_TAKING", "10"),
      fakeApplication("b", "applicant-1", "FOR_OATH_TAKING", "20"),
      fakeApplication("c", "applicant-2", "FOR_OATH_TAKING", "33"),
    ];
    const recommendations = computeHireRecommendations(applications);
    expect(recommendations.has("applicant-2")).toBe(false);
    expect(recommendations.get("applicant-1")?.recommendedApplicationId).toBe("b");
  });
});
