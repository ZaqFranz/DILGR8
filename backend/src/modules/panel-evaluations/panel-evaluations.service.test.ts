import { describe, expect, it } from "vitest";
import { assignCompetitionRanks } from "./panel-evaluations.service";

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
