import type { EducationLevel, EligibilityType } from "@/features/applicant-registration/types";

export type JobPostingStatus = "OPEN" | "CLOSED";

export interface JobPosting {
  id: string;
  title: string;
  // The Position this posting was created from, if any - drives which
  // panelists get auto-assigned to it at creation time.
  positionId: string | null;
  // Free text set by the admin (e.g. "ROS-1", "ROS-2") - not a fixed list.
  publication: string;
  description: string;
  numberOfVacantPositions: string;
  plantillaNumbers: string;
  salaryGrade: string;
  monthlySalary: string;
  placeOfAssignment: string;
  positionNextInRank: string;
  qualificationEducation: string;
  qualificationTraining: string;
  qualificationExperience: string;
  qualificationEligibility: string;
  requiredEligibilityTypes: EligibilityType[];
  // Structured minimums alongside the free-text qualificationX fields above
  // - null means no automatic Sifting hint for that criterion. See
  // qualificationMatch.ts.
  minEducationLevel: EducationLevel | null;
  minYearsExperience: number | null;
  minTrainingHours: number | null;
  duties: string;
  postedAt: string;
  closingAt: string;
  status: JobPostingStatus;
}

// monthlySalary is deliberately absent from these two input types - it's
// server-computed from salaryGrade
// (backend/src/shared/constants/salaryGrades.ts) on every create/update,
// never admin-typed. See docs/decisions.md's 2026-08-12 entry.
export interface CreateJobPostingInput {
  title: string;
  positionId: string;
  publication: string;
  description: string;
  numberOfVacantPositions: string;
  plantillaNumbers: string;
  salaryGrade: string;
  placeOfAssignment: string;
  positionNextInRank: string;
  qualificationEducation: string;
  qualificationTraining: string;
  qualificationExperience: string;
  qualificationEligibility: string;
  requiredEligibilityTypes: EligibilityType[];
  minEducationLevel?: EducationLevel;
  minYearsExperience?: number;
  minTrainingHours?: number;
  duties: string;
}

export interface UpdateJobPostingInput {
  title?: string;
  positionId?: string;
  publication?: string;
  description?: string;
  numberOfVacantPositions?: string;
  plantillaNumbers?: string;
  salaryGrade?: string;
  placeOfAssignment?: string;
  positionNextInRank?: string;
  qualificationEducation?: string;
  qualificationTraining?: string;
  qualificationExperience?: string;
  qualificationEligibility?: string;
  requiredEligibilityTypes?: EligibilityType[];
  minEducationLevel?: EducationLevel | null;
  minYearsExperience?: number | null;
  minTrainingHours?: number | null;
  duties?: string;
  status?: JobPostingStatus;
}
