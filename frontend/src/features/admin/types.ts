import type { JobPosting } from "@/features/job-postings/types";
import type { DocumentType, EducationLevel, EligibilityType } from "@/features/applicant-registration/types";

export type ApplicationStatus =
  | "SUBMITTED"
  | "UNDER_SIFTING"
  | "FOR_INTERVIEW"
  | "QUALIFIED"
  | "NOT_QUALIFIED"
  | "FOR_COMPLIANCE"
  | "NOT_SELECTED"
  | "DISQUALIFIED"
  | "FOR_OATH_TAKING"
  | "HIRED"
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
  complianceRequestedAt: string | null;
  complianceCompletedAt: string | null;
  oathTakingScheduledAt: string | null;
  oathTakingVenue: string | null;
  oathTakingNotes: string | null;
  hiredAt: string | null;
  rejectedAt: string | null;
  rejectionRemarks: string | null;
  jobPosting: JobPosting;
  applicant: {
    id: string;
    firstName: string;
    lastName: string;
    user: { email: string };
    // Structured fields used by qualificationMatch.ts to compute the
    // Sifting "meets/below" hint against jobPosting's minX fields above.
    educationLevel: EducationLevel;
    yearsOfExperience: number;
    hasEligibility: boolean;
    eligibilityType: EligibilityType;
    ldInterventions: { numberOfHours: number }[];
  };
}

export type ComplianceItemStatus = "PENDING" | "VERIFIED" | "REJECTED";
export type ComplianceSubmissionType = "SOFTCOPY" | "HARDCOPY";

export interface ComplianceRequirement {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateComplianceRequirementInput {
  name: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateComplianceRequirementInput {
  name?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ApplicationComplianceItem {
  id: string;
  applicationId: string;
  requirementId: string;
  status: ComplianceItemStatus;
  submissionType: ComplianceSubmissionType;
  remarks: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  requirement: ComplianceRequirement;
  documents: AdminDocument[];
}

export interface AddComplianceItemInput {
  requirementId: string;
  submissionType?: ComplianceSubmissionType;
}

export interface ReviewComplianceItemInput {
  status: "VERIFIED" | "REJECTED";
  remarks?: string;
}

export interface ScheduleOathTakingInput {
  scheduledAt: string;
  venue: string;
  notes?: string;
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

export interface RejectApplicationInput {
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
  applicant: { firstName: string; lastName: string } | null;
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

// One individually-scored rubric line within a Category - a panelist marks
// this directly (0-maxScore), not the category as a whole.
export interface Criterion {
  id: string;
  name: string;
  maxScore: number;
  sortOrder: number;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  // This category's authoritative share of the overall evaluation (e.g.
  // 25 = 25%) - admin-set, independent of whatever `criteria` sum to. A
  // panelist's raw subtotal for this category is normalized against
  // `maxScore` below and scaled to this before it counts toward the
  // overall score.
  weightPercent: number;
  criteria: Criterion[];
  // Not a stored field - the sum of `criteria`'s (active) maxScore, i.e.
  // the *raw* scale a panelist actually fills scores in against, computed
  // server-side so every reader agrees on it without recomputing
  // themselves. Not the category's real contribution to the overall
  // evaluation - that's `weightPercent`.
  maxScore: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// `id` present = update that existing criterion in place; absent = create a
// new one. Anything already on file but missing from the array is removed,
// unless it already has recorded scores (409) - same shape the backend's
// diff-based replaceCriteria() expects.
export interface CriterionInput {
  id?: string;
  name: string;
  maxScore: number;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CreateCategoryInput {
  name: string;
  weightPercent: number;
  criteria?: CriterionInput[];
  sortOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  weightPercent?: number;
  criteria?: CriterionInput[];
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

export interface BulkAssignPanelResult {
  created: PanelAssignment[];
  skippedCount: number;
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
  examinationScore: number | null;
  jobPosting: { id: string; title: string };
  applicant: { id: string; firstName: string; lastName: string };
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

export interface ApplicantScoreCategoryColumn {
  id: string;
  name: string;
  // The weight (0-100), not a raw point total - the ceiling the weighted
  // per-category value in each row can actually reach.
  weightPercent: number;
}

export interface ApplicantScoreRow {
  applicationId: string;
  applicantName: string;
  jobPostingTitle: string;
  perCategory: Record<string, number | null>;
  total: number | null;
  panelistsSubmitted: number;
}

export interface ApplicantScoresOverview {
  categories: ApplicantScoreCategoryColumn[];
  rows: ApplicantScoreRow[];
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
