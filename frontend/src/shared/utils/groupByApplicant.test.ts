import { describe, expect, it } from "vitest";
import { groupByApplicant } from "./groupByApplicant";

interface Row {
  id: string;
  applicantId: string;
}

function row(id: string, applicantId: string): Row {
  return { id, applicantId };
}

describe("groupByApplicant", () => {
  it("returns an empty array for empty input", () => {
    expect(groupByApplicant<Row>([], (r) => r.applicantId)).toEqual([]);
  });

  it("groups single-item rows into single-item groups", () => {
    const rows = [row("a", "applicant-1"), row("b", "applicant-2")];

    const groups = groupByApplicant(rows, (r) => r.applicantId);

    expect(groups).toEqual([
      { key: "applicant-1", rows: [row("a", "applicant-1")] },
      { key: "applicant-2", rows: [row("b", "applicant-2")] },
    ]);
  });

  it("groups multiple rows sharing a key into one group, preserving row order", () => {
    const rows = [row("a", "applicant-1"), row("b", "applicant-1")];

    const groups = groupByApplicant(rows, (r) => r.applicantId);

    expect(groups).toEqual([{ key: "applicant-1", rows: [row("a", "applicant-1"), row("b", "applicant-1")] }]);
  });

  it("preserves first-seen order across a mixed key set, even when a key's rows aren't contiguous", () => {
    const rows = [row("a", "applicant-1"), row("b", "applicant-2"), row("c", "applicant-1"), row("d", "applicant-3")];

    const groups = groupByApplicant(rows, (r) => r.applicantId);

    expect(groups.map((g) => g.key)).toEqual(["applicant-1", "applicant-2", "applicant-3"]);
    expect(groups[0]!.rows).toEqual([row("a", "applicant-1"), row("c", "applicant-1")]);
  });
});
