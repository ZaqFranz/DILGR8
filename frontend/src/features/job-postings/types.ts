import type { EligibilityType } from "@/features/applicant-registration/types";

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
  duties: string;
  postedAt: string;
  closingAt: string;
  status: JobPostingStatus;
}

export interface CreateJobPostingInput {
  title: string;
  positionId: string;
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
