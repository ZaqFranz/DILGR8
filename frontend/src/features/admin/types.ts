import type { JobPosting } from "@/features/job-postings/types";
import type { DocumentType } from "@/features/applicant-registration/types";

export type ApplicationStatus =
  | "SUBMITTED"
  | "UNDER_SIFTING"
  | "FOR_INTERVIEW"
  | "QUALIFIED"
  | "NOT_QUALIFIED"
  | "WITHDRAWN";
export type EvaluationDecision = "QUALIFIED" | "NOT_QUALIFIED";

export interface AdminApplication {
  id: string;
  status: ApplicationStatus;
  submittedAt: string;
  siftingRemarks: string | null;
  siftedAt: string | null;
  examinationScore: number | null;
  examinationScoredAt: string | null;
  interviewScheduledAt: string | null;
  interviewScheduledEndAt: string | null;
  interviewVenue: string | null;
  interviewAttire: string | null;
  interviewNotes: string | null;
  jobPosting: JobPosting;
  applicant: {
    id: string;
    firstName: string;
    lastName: string;
    user: { email: string };
  };
}

export interface PositionPanelMember {
  id: string;
  panelUserId: string;
  panelUser: { id: string; email: string; name: string | null };
}

export interface Position {
  id: string;
  title: string;
  panelMembers: PositionPanelMember[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePositionInput {
  title: string;
  panelUserIds?: string[];
}

export interface UpdatePositionInput {
  title?: string;
  panelUserIds?: string[];
}

export interface AdminDocument {
  id: string;
  type: DocumentType;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedAt: string;
  ldInterventionId: string | null;
  awardId: string | null;
}

export interface SiftApplicationInput {
  decision: EvaluationDecision;
  remarks?: string;
}

export interface ScheduleInterviewInput {
  scheduledAt: string;
  scheduledEndAt?: string;
  venue: string;
  attire?: string;
  notes?: string;
}

export interface ExamScoreImportResult {
  matched: { applicationId: string; applicantName: string; score: number }[];
  unmatched: { name: string; score: number; jobTitle?: string }[];
}

export type UserRole = "ADMIN" | "APPLICANT" | "PANEL";

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  role: UserRole;
  name: string;
}

export interface UpdateUserInput {
  email?: string;
  role?: UserRole;
  name?: string;
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

export interface EvaluationCriterionQuestion {
  id: string;
  text: string;
  sortOrder: number;
}

export interface EvaluationCriterion {
  id: string;
  name: string;
  questions: EvaluationCriterionQuestion[];
  maxScore: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEvaluationCriterionInput {
  name: string;
  questions?: string[];
  maxScore: number;
  sortOrder?: number;
}

export interface UpdateEvaluationCriterionInput {
  name?: string;
  questions?: string[];
  maxScore?: number;
  sortOrder?: number;
  isActive?: boolean;
}

export interface PanelAssignment {
  id: string;
  jobPostingId: string;
  panelUserId: string;
  assignedAt: string;
  panelUser: { id: string; email: string; name: string | null };
}

export interface PanelScore {
  criterionId: string;
  score: number;
}

export interface PanelEvaluation {
  id: string;
  applicationId: string;
  panelUserId: string;
  remarks: string | null;
  submittedAt: string;
  updatedAt: string;
  scores: PanelScore[];
}

export interface InterviewQueueApplication {
  id: string;
  status: ApplicationStatus;
  submittedAt: string;
  jobPosting: { id: string; title: string };
  applicant: { firstName: string; lastName: string };
  panelEvaluations: PanelEvaluation[];
}

export interface SubmitPanelEvaluationInput {
  remarks?: string;
  scores: { criterionId: string; score: number }[];
}

export interface TabulationRow {
  applicationId: string;
  applicantName: string;
  perPanelist: Record<string, number | null>;
  average: number | null;
  rank: number | null;
  panelistsSubmitted: number;
  panelistsAssigned: number;
}

export interface TabulationResult {
  panelists: { id: string; email: string }[];
  rows: TabulationRow[];
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
