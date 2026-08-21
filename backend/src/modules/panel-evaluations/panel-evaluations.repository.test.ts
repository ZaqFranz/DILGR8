import { describe, expect, it } from "vitest";
import { collectScoreSourceIds, mergeInheritedEvaluations } from "./panel-evaluations.repository";
import type { PanelEvaluationWithScores } from "./panel-evaluations.repository";

function fakeEvaluation(applicationId: string): PanelEvaluationWithScores {
  return {
    id: `eval-${applicationId}`,
    applicationId,
    panelUserId: "panelist-1",
    remarks: null,
    submittedAt: new Date(),
    updatedAt: new Date(),
    scores: [{ id: `score-${applicationId}`, panelEvaluationId: `eval-${applicationId}`, criterionId: "crit-1", score: 8 }],
  };
}

interface FakeApplication {
  id: string;
  scoreSourceApplicationId: string | null;
  panelEvaluations: PanelEvaluationWithScores[];
}

function fakeApplication(id: string, scoreSourceApplicationId: string | null, panelEvaluations: PanelEvaluationWithScores[] = []): FakeApplication {
  return { id, scoreSourceApplicationId, panelEvaluations };
}

describe("collectScoreSourceIds", () => {
  it("returns nothing when every application has its own evaluations", () => {
    const applications = [
      fakeApplication("a", null, [fakeEvaluation("a")]),
      fakeApplication("b", null, [fakeEvaluation("b")]),
    ];
    expect(collectScoreSourceIds(applications)).toEqual([]);
  });

  it("dedupes when multiple applications share one source", () => {
    const applications = [
      fakeApplication("a", "source-1"),
      fakeApplication("b", "source-1"),
      fakeApplication("c", "source-2"),
    ];
    expect(collectScoreSourceIds(applications).sort()).toEqual(["source-1", "source-2"]);
  });

  it("ignores an application with no source and no evaluations of its own", () => {
    const applications = [fakeApplication("a", null)];
    expect(collectScoreSourceIds(applications)).toEqual([]);
  });

  it("ignores a scoreSourceApplicationId on an application that already has its own evaluations", () => {
    // Shouldn't happen in practice (the service refuses to score an
    // application that's already inheriting), but the collector should
    // still prefer "has its own data" over the stale pointer.
    const applications = [fakeApplication("a", "source-1", [fakeEvaluation("a")])];
    expect(collectScoreSourceIds(applications)).toEqual([]);
  });
});

describe("mergeInheritedEvaluations", () => {
  it("substitutes an inheriting application's empty evaluations with its resolved source's", () => {
    const sourceEval = fakeEvaluation("source-1");
    const applications = [fakeApplication("a", "source-1")];
    const byApplicationId = new Map([["source-1", [sourceEval]]]);

    const merged = mergeInheritedEvaluations(applications, byApplicationId);

    expect(merged[0]!.panelEvaluations).toEqual([sourceEval]);
  });

  it("leaves an application with its own evaluations untouched, even with a stale scoreSourceApplicationId", () => {
    const ownEval = fakeEvaluation("a");
    const applications = [fakeApplication("a", "source-1", [ownEval])];
    const byApplicationId = new Map([["source-1", [fakeEvaluation("source-1")]]]);

    const merged = mergeInheritedEvaluations(applications, byApplicationId);

    expect(merged[0]!.panelEvaluations).toEqual([ownEval]);
  });

  it("leaves a source-less, unscored application's empty evaluations empty", () => {
    const applications = [fakeApplication("a", null)];

    const merged = mergeInheritedEvaluations(applications, new Map());

    expect(merged[0]!.panelEvaluations).toEqual([]);
  });

  it("resolves an empty array when the source id isn't in the map (source itself unscored yet)", () => {
    const applications = [fakeApplication("a", "source-1")];

    const merged = mergeInheritedEvaluations(applications, new Map());

    expect(merged[0]!.panelEvaluations).toEqual([]);
  });
});
