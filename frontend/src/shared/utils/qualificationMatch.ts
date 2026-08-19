import { EDUCATION_LEVEL_VALUES } from "@/shared/constants/educationLevels";
import type { AdminApplication } from "@/features/admin/types";

export type MatchStatus = "MEETS" | "BELOW" | "NOT_SET";

export interface QualificationMatch {
  education: MatchStatus;
  training: MatchStatus;
  experience: MatchStatus;
  eligibility: MatchStatus;
}

// Computed client-side (not persisted/returned by the API) so the hint
// always reflects the application's current data, including right after a
// sift/schedule/etc. action replaces the row - see EvaluationRow.tsx.
export function computeQualificationMatch(application: AdminApplication): QualificationMatch {
  const { applicant, jobPosting } = application;

  const education: MatchStatus = !jobPosting.minEducationLevel
    ? "NOT_SET"
    : EDUCATION_LEVEL_VALUES.indexOf(applicant.educationLevel) >= EDUCATION_LEVEL_VALUES.indexOf(jobPosting.minEducationLevel)
      ? "MEETS"
      : "BELOW";

  const experience: MatchStatus =
    jobPosting.minYearsExperience == null
      ? "NOT_SET"
      : applicant.yearsOfExperience >= jobPosting.minYearsExperience
        ? "MEETS"
        : "BELOW";

  const totalTrainingHours = applicant.ldInterventions.reduce((sum, entry) => sum + entry.numberOfHours, 0);
  const training: MatchStatus =
    jobPosting.minTrainingHours == null
      ? "NOT_SET"
      : totalTrainingHours >= jobPosting.minTrainingHours
        ? "MEETS"
        : "BELOW";

  const eligibility: MatchStatus =
    jobPosting.requiredEligibilityTypes.length === 0
      ? "NOT_SET"
      : applicant.hasEligibility && jobPosting.requiredEligibilityTypes.includes(applicant.eligibilityType)
        ? "MEETS"
        : "BELOW";

  return { education, training, experience, eligibility };
}
