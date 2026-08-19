import { describe, expect, it } from "vitest";
import type { Criterion } from "@prisma/client";
import { assignCompetitionRanks, buildCriterionIdsByCategory, weightedCategoryScore, weightedTotalScore } from "./panel-evaluations.service";
import type { CategoryWithCriteria } from "@/modules/categories/categories.repository";
import type { PanelEvaluationWithScores } from "./panel-evaluations.repository";

function fakeCriterion(id: string, categoryId: string, maxScore: number): Criterion {
  return { id, categoryId, name: id, maxScore, sortOrder: 0, isActive: true, createdAt: new Date() };
}

function fakeCategory(id: string, weightPercent: number, criteria: Criterion[]): CategoryWithCriteria {
  return {
    id,
    name: id,
    weightPercent,
    sortOrder: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    criteria,
    maxScore: criteria.filter((c) => c.isActive).reduce((sum, c) => sum + c.maxScore, 0),
  };
}

function fakeEvaluation(scores: { criterionId: string; score: number }[]): PanelEvaluationWithScores {
  return {
    id: "eval-1",
    applicationId: "app-1",
    panelUserId: "panelist-1",
    remarks: null,
    submittedAt: new Date(),
    updatedAt: new Date(),
    scores: scores.map((s, i) => ({ id: `score-${i}`, panelEvaluationId: "eval-1", criterionId: s.criterionId, score: s.score })),
  };
}

describe("assignCompetitionRanks", () => {
  it("ranks distinct averages sequentially", () => {
    const rows = [
      { id: "a", average: 70, rank: null as number | null },
      { id: "b", average: 90, rank: null as number | null },
      { id: "c", average: 80, rank: null as number | null },
    ];
    assignCompetitionRanks(rows);
    expect(rows.find((r) => r.id === "b")!.rank).toBe(1);
    expect(rows.find((r) => r.id === "c")!.rank).toBe(2);
    expect(rows.find((r) => r.id === "a")!.rank).toBe(3);
  });

  it("gives tied averages the same rank and skips the next rank accordingly (1224 competition ranking)", () => {
    const rows = [
      { id: "a", average: 85, rank: null as number | null },
      { id: "b", average: 90, rank: null as number | null },
      { id: "c", average: 90, rank: null as number | null },
      { id: "d", average: 70, rank: null as number | null },
    ];
    assignCompetitionRanks(rows);
    expect(rows.find((r) => r.id === "b")!.rank).toBe(1);
    expect(rows.find((r) => r.id === "c")!.rank).toBe(1);
    // Two applications tied for 1st - the next distinct average is rank 3,
    // not 2 (this is the exact bug being regression-tested: a plain
    // running counter would have given "a" rank 2 here).
    expect(rows.find((r) => r.id === "a")!.rank).toBe(3);
    expect(rows.find((r) => r.id === "d")!.rank).toBe(4);
  });

  it("handles a three-way tie for first followed by a distinct value", () => {
    const rows = [
      { id: "a", average: 100, rank: null as number | null },
      { id: "b", average: 100, rank: null as number | null },
      { id: "c", average: 100, rank: null as number | null },
      { id: "d", average: 50, rank: null as number | null },
    ];
    assignCompetitionRanks(rows);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 1, 4]);
  });

  it("leaves unscored (null average) rows unranked and doesn't let them affect others' ranks", () => {
    const rows = [
      { id: "a", average: null as number | null, rank: null as number | null },
      { id: "b", average: 80, rank: null as number | null },
      { id: "c", average: null as number | null, rank: null as number | null },
      { id: "d", average: 60, rank: null as number | null },
    ];
    assignCompetitionRanks(rows);
    expect(rows.find((r) => r.id === "a")!.rank).toBeNull();
    expect(rows.find((r) => r.id === "c")!.rank).toBeNull();
    expect(rows.find((r) => r.id === "b")!.rank).toBe(1);
    expect(rows.find((r) => r.id === "d")!.rank).toBe(2);
  });

  it("returns the same array instance it mutated", () => {
    const rows = [{ id: "a", average: 1, rank: null as number | null }];
    expect(assignCompetitionRanks(rows)).toBe(rows);
  });
});

describe("weightedCategoryScore", () => {
  it("normalizes a raw subtotal against the category's raw max and scales to weightPercent", () => {
    expect(weightedCategoryScore(20, 40, 25)).toBe(12.5); // half of 40 raw points -> half of 25% weight
    expect(weightedCategoryScore(40, 40, 25)).toBe(25); // full raw score -> full weight
    expect(weightedCategoryScore(0, 40, 25)).toBe(0);
  });

  it("returns 0 when there's no raw max to normalize against (no active criteria)", () => {
    expect(weightedCategoryScore(0, 0, 25)).toBe(0);
  });
});

describe("weightedTotalScore", () => {
  it("keeps a category's contribution fixed at its weight regardless of how many criteria it has or what they sum to - the client's exact scenario ('even I have many criteria max point should still be 25% of the overall evaluation')", () => {
    // Category A: 25% weight, 1 criterion worth 10 raw points, scored to max.
    const categoryA = fakeCategory("catA", 25, [fakeCriterion("q1", "catA", 10)]);
    const evalA = fakeEvaluation([{ criterionId: "q1", score: 10 }]);

    // Category B: same 25% weight, but split into 4 criteria summing to 100 raw points instead of 10 - also scored to max.
    const categoryB = fakeCategory("catB", 25, [
      fakeCriterion("q1b", "catB", 25),
      fakeCriterion("q2b", "catB", 25),
      fakeCriterion("q3b", "catB", 25),
      fakeCriterion("q4b", "catB", 25),
    ]);
    const evalB = fakeEvaluation([
      { criterionId: "q1b", score: 25 },
      { criterionId: "q2b", score: 25 },
      { criterionId: "q3b", score: 25 },
      { criterionId: "q4b", score: 25 },
    ]);

    // Both max out at exactly 25, the shared weight - having 10x the raw
    // point total (and 4x the criteria) doesn't let category B outweigh A.
    expect(weightedTotalScore(evalA, [categoryA], buildCriterionIdsByCategory([categoryA]))).toBe(25);
    expect(weightedTotalScore(evalB, [categoryB], buildCriterionIdsByCategory([categoryB]))).toBe(25);
  });

  it("sums weighted contributions across multiple categories", () => {
    const categoryA = fakeCategory("catA", 25, [fakeCriterion("q1", "catA", 10)]);
    const categoryB = fakeCategory("catB", 75, [fakeCriterion("q2", "catB", 20)]);
    const categories = [categoryA, categoryB];
    const evaluation = fakeEvaluation([
      { criterionId: "q1", score: 5 }, // half of catA's raw max -> 12.5
      { criterionId: "q2", score: 20 }, // full of catB's raw max -> 75
    ]);
    expect(weightedTotalScore(evaluation, categories, buildCriterionIdsByCategory(categories))).toBe(87.5);
  });

  it("a category with no active criteria contributes 0 regardless of its weight", () => {
    const category = fakeCategory("catA", 25, []);
    const evaluation = fakeEvaluation([]);
    expect(weightedTotalScore(evaluation, [category], buildCriterionIdsByCategory([category]))).toBe(0);
  });

  it("only counts scores belonging to the category being computed, ignoring other categories' criteria", () => {
    const categoryA = fakeCategory("catA", 50, [fakeCriterion("q1", "catA", 10)]);
    const categoryB = fakeCategory("catB", 50, [fakeCriterion("q2", "catB", 10)]);
    // A single evaluation scoring both categories' criteria.
    const evaluation = fakeEvaluation([
      { criterionId: "q1", score: 10 },
      { criterionId: "q2", score: 0 },
    ]);
    const map = buildCriterionIdsByCategory([categoryA, categoryB]);
    expect(weightedTotalScore(evaluation, [categoryA], map)).toBe(50); // catA maxed out
    expect(weightedTotalScore(evaluation, [categoryB], map)).toBe(0); // catB scored 0
    expect(weightedTotalScore(evaluation, [categoryA, categoryB], map)).toBe(50); // combined
  });
});
