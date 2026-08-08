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

export type UserRole = "ADMIN" | "APPLICANT";

export interface AdminUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserInput {
  email?: string;
  role?: UserRole;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
  actor: { email: string } | null;
}

export interface DashboardSummary {
  applicants: {
    total: number;
    registrationComplete: number;
  };
  users: {
    total: number;
    byRole: Record<UserRole, number>;
  };
  jobPostings: {
    total: number;
    byStatus: Record<"OPEN" | "CLOSED", number>;
  };
  applications: {
    total: number;
    byStatus: Record<ApplicationStatus, number>;
  };
  topJobPostings: Array<{ jobPostingId: string; title: string; applicationCount: number }>;
  recentActivity: AuditLogEntry[];
}
