import type { EligibilityType } from "@/features/applicant-registration/types";

export type JobPostingStatus = "OPEN" | "CLOSED";

export interface JobPosting {
  id: string;
  title: string;
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
  duties: string;
  postedAt: string;
  closingAt: string;
  status: JobPostingStatus;
}

export interface CreateJobPostingInput {
  title: string;
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
  duties: string;
}

export interface UpdateJobPostingInput {
  title?: string;
  description?: string;
  numberOfVacantPositions?: string;
  plantillaNumbers?: string;
  salaryGrade?: string;
  monthlySalary?: string;
  placeOfAssignment?: string;
  positionNextInRank?: string;
  qualificationEducation?: string;
  qualificationTraining?: string;
  qualificationExperience?: string;
  qualificationEligibility?: string;
  requiredEligibilityTypes?: EligibilityType[];
  duties?: string;
  status?: JobPostingStatus;
}
