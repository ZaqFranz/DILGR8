import { groupByApplicant } from "@/shared/utils/groupByApplicant";
import type { AdminApplication } from "../types";

/**
 * Client requirement (revised 2026-08-21 - see docs/decisions.md): once an
 * applicant has reached FOR_OATH_TAKING (cleared Compliance) on 2+ of their
 * applications, the admin manually picks which one posting to actually
 * assign them to via the "Assign Position" action - no automatic
 * highest-Salary-Grade recommendation (that was the previous design,
 * removed per client feedback: "this is manual from Admin no need to
 * assign the highest SG automatically"). This only groups+filters; it
 * never ranks or picks a winner.
 */
export function findOathTakingCandidates(applications: AdminApplication[]): Map<string, AdminApplication[]> {
  const oathTaking = applications.filter((application) => application.status === "FOR_OATH_TAKING");
  const groups = groupByApplicant(oathTaking, (application) => application.applicant.id);

  const result = new Map<string, AdminApplication[]>();
  for (const group of groups) {
    if (group.rows.length < 2) continue;
    result.set(group.key, group.rows);
  }
  return result;
}
