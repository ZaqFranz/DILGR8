import { groupByApplicant } from "@/shared/utils/groupByApplicant";
import type { ApplicantScoreRow } from "../types";

export interface CombinedApplicantScoreRow extends ApplicantScoreRow {
  // Every posting this applicant applied to within the current row set (1
  // for a single-posting applicant), for callers that want to render each
  // one individually (e.g. ReportSummaryPage's per-posting status badges)
  // rather than just the joined jobPostingTitle string below.
  postings: { jobPostingTitle: string; status: ApplicantScoreRow["status"] }[];
}

/**
 * Score inheritance means a multi-posting applicant's sibling rows already
 * carry identical perCategory/perCriterion/total data (resolveInherited()
 * backfills them server-side) - so unlike EvaluateApplicantsPage, there's
 * nothing to expand/collapse here, just one representative row per
 * applicant. jobPostingTitle on the representative row becomes every
 * posting's title joined together, so a caller that only renders that
 * field (ApplicantScoresModal) already gets a sensible combined display;
 * `postings` carries the per-posting title+status detail for callers that
 * want to render each one separately (Report Summary).
 */
export function combineApplicantRows(rows: ApplicantScoreRow[]): CombinedApplicantScoreRow[] {
  return groupByApplicant(rows, (row) => row.applicantId).map((group) => {
    const first = group.rows[0]!;
    const postings = group.rows.map((row) => ({ jobPostingTitle: row.jobPostingTitle, status: row.status }));
    if (group.rows.length === 1) return { ...first, postings };
    return { ...first, jobPostingTitle: group.rows.map((row) => row.jobPostingTitle).join(", "), postings };
  });
}
