import { describe, expect, it } from "vitest";
import { collectScoreSourceIds, mergeInheritedEvaluations, partitionQueueCandidatesToRepair } from "./panel-evaluations.repository";
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

describe("partitionQueueCandidatesToRepair", () => {
  function candidate(id: string, applicantId: string) {
    return { id, applicantId };
  }

  it("leaves every candidate as still-needs-scoring when nobody's applicant has a canonical scored application", () => {
    const candidates = [candidate("appB", "applicant-1"), candidate("appD", "applicant-2")];

    const { toLink, stillNeedsScoring } = partitionQueueCandidatesToRepair(candidates, new Map());

    expect(toLink).toEqual([]);
    expect(stillNeedsScoring).toEqual(candidates);
  });

  it("links a candidate to its applicant's canonical scored application and excludes it from stillNeedsScoring", () => {
    const candidates = [candidate("appB", "applicant-1")];
    const canonicalByApplicant = new Map([["applicant-1", "appA"]]);

    const { toLink, stillNeedsScoring } = partitionQueueCandidatesToRepair(candidates, canonicalByApplicant);

    expect(toLink).toEqual([{ candidateId: "appB", canonicalId: "appA" }]);
    expect(stillNeedsScoring).toEqual([]);
  });

  it("leaves the canonical application itself in stillNeedsScoring rather than linking it to itself", () => {
    // Shouldn't happen in practice (a scored application is excluded from
    // the queue by scoreSourceApplicationId/panelEvaluations filters
    // upstream), but the partition itself should never self-link.
    const candidates = [candidate("appA", "applicant-1")];
    const canonicalByApplicant = new Map([["applicant-1", "appA"]]);

    const { toLink, stillNeedsScoring } = partitionQueueCandidatesToRepair(candidates, canonicalByApplicant);

    expect(toLink).toEqual([]);
    expect(stillNeedsScoring).toEqual(candidates);
  });

  it("only links candidates whose own applicant has a canonical match, leaving other applicants' candidates untouched", () => {
    const candidates = [candidate("appB", "applicant-1"), candidate("appD", "applicant-2")];
    const canonicalByApplicant = new Map([["applicant-1", "appA"]]);

    const { toLink, stillNeedsScoring } = partitionQueueCandidatesToRepair(candidates, canonicalByApplicant);

    expect(toLink).toEqual([{ candidateId: "appB", canonicalId: "appA" }]);
    expect(stillNeedsScoring).toEqual([candidate("appD", "applicant-2")]);
  });
});
