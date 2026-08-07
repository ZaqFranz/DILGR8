import type { JobPosting } from "@/features/job-postings/types";

export type ApplicationStatus = "SUBMITTED" | "UNDER_SIFTING" | "QUALIFIED" | "NOT_QUALIFIED" | "WITHDRAWN";
export type EvaluationDecision = "QUALIFIED" | "NOT_QUALIFIED";

export interface AdminApplication {
  id: string;
  status: ApplicationStatus;
  submittedAt: string;
  evaluationScore: number | null;
  evaluationRemarks: string | null;
  evaluatedAt: string | null;
  jobPosting: JobPosting;
  applicant: {
    id: string;
    firstName: string;
    lastName: string;
    user: { email: string };
  };
}

export interface EvaluateApplicationInput {
  score: number;
  decision: EvaluationDecision;
  remarks?: string;
}
