import type { AdminApplication } from "../types";

export interface HireRecommendation {
  recommendedApplicationId: string;
  // Every other FOR_OATH_TAKING application for this same applicant,
  // excluding the recommended one - used to render the caution banner on
  // each of them.
  otherApplicationIds: string[];
}

/**
 * Client requirement: "if applicant passed in all the Job Posting he
 * applied he will be hired in the Higher position or Higher SG level."
 * Triggers only once an applicant has reached FOR_OATH_TAKING (cleared
 * Compliance) on 2+ applications - not earlier. Recommendation only: the
 * admin still clicks Mark Hired themselves (see docs/decisions.md); this
 * never changes any status on its own.
 */
export function computeHireRecommendations(applications: AdminApplication[]): Map<string, HireRecommendation> {
  const byApplicant = new Map<string, AdminApplication[]>();
  for (const application of applications) {
    if (application.status !== "FOR_OATH_TAKING") continue;
    const key = application.applicant.id;
    byApplicant.set(key, [...(byApplicant.get(key) ?? []), application]);
  }

  const result = new Map<string, HireRecommendation>();
  for (const [applicantId, apps] of byApplicant) {
    if (apps.length < 2) continue;
    const recommended = apps.reduce((best, current) =>
      parseInt(current.jobPosting.salaryGrade, 10) > parseInt(best.jobPosting.salaryGrade, 10) ? current : best,
    );
    result.set(applicantId, {
      recommendedApplicationId: recommended.id,
      otherApplicationIds: apps.filter((application) => application.id !== recommended.id).map((application) => application.id),
    });
  }
  return result;
}
