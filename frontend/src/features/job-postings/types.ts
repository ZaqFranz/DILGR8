export type PositionLevel = "ENTRY" | "PROMOTIONAL";
export type JobPostingStatus = "OPEN" | "CLOSED";

export interface JobPosting {
  id: string;
  title: string;
  positionLevel: PositionLevel;
  qualificationEducation: string;
  qualificationTraining: string;
  qualificationExperience: string;
  qualificationEligibility: string;
  postedAt: string;
  closingAt: string;
  status: JobPostingStatus;
}

export interface CreateJobPostingInput {
  title: string;
  positionLevel: PositionLevel;
  qualificationEducation: string;
  qualificationTraining: string;
  qualificationExperience: string;
  qualificationEligibility: string;
}

export interface UpdateJobPostingInput {
  title?: string;
  positionLevel?: PositionLevel;
  qualificationEducation?: string;
  qualificationTraining?: string;
  qualificationExperience?: string;
  qualificationEligibility?: string;
  status?: JobPostingStatus;
}
