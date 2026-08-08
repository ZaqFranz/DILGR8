export const APPLICATION_STATUSES = [
  "SUBMITTED",
  "UNDER_SIFTING",
  "FOR_INTERVIEW",
  "QUALIFIED",
  "NOT_QUALIFIED",
  "WITHDRAWN",
] as const;
export const JOB_POSTING_STATUSES = ["OPEN", "CLOSED"] as const;
export const USER_ROLES = ["ADMIN", "APPLICANT", "PANEL"] as const;

export interface DashboardSummaryDto {
  applicants: {
    total: number;
    registrationComplete: number;
  };
  users: {
    total: number;
    byRole: Record<(typeof USER_ROLES)[number], number>;
  };
  jobPostings: {
    total: number;
    byStatus: Record<(typeof JOB_POSTING_STATUSES)[number], number>;
  };
  applications: {
    total: number;
    byStatus: Record<(typeof APPLICATION_STATUSES)[number], number>;
  };
  topJobPostings: Array<{ jobPostingId: string; title: string; applicationCount: number }>;
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    details: string | null;
    createdAt: Date;
    actor: { email: string } | null;
  }>;
}
