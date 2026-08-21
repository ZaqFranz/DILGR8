import type { Application, ApplicationStatus, EligibilityType, LdIntervention, Prisma, PrismaClient } from "@prisma/client";

// An application can be withdrawn any time before its outcome is already
// final - NOT_QUALIFIED, NOT_SELECTED, DISQUALIFIED, HIRED, and WITHDRAWN
// itself are all terminal, so they're the only statuses excluded here.
// FOR_COMPLIANCE/FOR_OATH_TAKING stay "open" (an applicant can still decline
// up until actually hired). Also used to decide which of an applicant's
// other applications are still "in flight" for score-inheritance linking and
// for auto-closing siblings once the applicant is hired elsewhere.
export const OPEN_APPLICATION_STATUSES = [
  "SUBMITTED",
  "UNDER_SIFTING",
  "QUALIFIED",
  "FOR_INTERVIEW",
  "FOR_COMPLIANCE",
  "FOR_OATH_TAKING",
] as const;

const applicationWithPostingInclude = {
  jobPosting: true,
  documents: true,
  // So MyApplicationsPage can tell the applicant "your interview score was
  // carried over from your application to X" instead of just silently
  // showing a score with no explanation of where it came from.
  scoreSourceApplication: { select: { jobPosting: { select: { title: true } } } },
} as const;

const applicationWithApplicantInclude = {
  jobPosting: { include: { requiredEligibilities: true } },
  applicant: {
    include: {
      user: { select: { email: true } },
      // Needed to sum total training hours for the Sifting qualification
      // hint - see frontend/src/shared/utils/qualificationMatch.ts.
      ldInterventions: true,
    },
  },
} as const;

export type ApplicationWithPosting = Application & {
  jobPosting: NonNullable<Awaited<ReturnType<PrismaClient["jobPosting"]["findUnique"]>>>;
  scoreSourceApplication: { jobPosting: { title: string } } | null;
};

export type ApplicationWithApplicant = Application & {
  jobPosting: NonNullable<Awaited<ReturnType<PrismaClient["jobPosting"]["findUnique"]>>> & {
    requiredEligibilityTypes: EligibilityType[];
  };
  applicant: NonNullable<Awaited<ReturnType<PrismaClient["applicant"]["findUnique"]>>> & {
    user: { email: string };
    ldInterventions: LdIntervention[];
  };
};

type RawApplicationWithApplicant = Application & {
  jobPosting: NonNullable<Awaited<ReturnType<PrismaClient["jobPosting"]["findUnique"]>>> & {
    requiredEligibilities: { eligibilityType: EligibilityType }[];
  };
  applicant: NonNullable<Awaited<ReturnType<PrismaClient["applicant"]["findUnique"]>>> & {
    user: { email: string };
    ldInterventions: LdIntervention[];
  };
};

// requiredEligibilities is a join table (JobPostingRequiredEligibility) -
// reshaped into a flat requiredEligibilityTypes array here, the same way
// JobPostingsRepository.toJobPostingWithEligibility() does, so every
// ApplicationWithApplicant carries what qualificationMatch.ts needs to
// compute the Eligibility hint without a second query.
function toApplicationWithApplicant(row: RawApplicationWithApplicant): ApplicationWithApplicant {
  const { requiredEligibilities, ...restPosting } = row.jobPosting;
  return {
    ...row,
    jobPosting: { ...restPosting, requiredEligibilityTypes: requiredEligibilities.map((r) => r.eligibilityType) },
  };
}

export interface SiftApplicationInput {
  status: ApplicationStatus;
  remarks?: string;
  siftedByUserId: string;
}

export interface ExaminationScoreUpdate {
  applicationId: string;
  score: number;
}

export interface ScheduleInterviewInput {
  scheduledAt: Date;
  scheduledEndAt?: Date;
  venue: string;
  attire?: string;
  notes?: string;
}

export interface ScheduleOathTakingInput {
  scheduledAt: Date;
  venue: string;
  notes?: string;
}

export interface ApplicationLetterFileInput {
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSizeBytes: number;
}

export class ApplicationsRepository {
  constructor(private readonly db: PrismaClient) {}

  /**
   * The Application Letter is addressed to a specific vacancy, so it's
   * collected at apply time rather than once at registration - created in
   * the same transaction as the Application itself so an application can
   * never exist without its required letter (or vice versa).
   */
  createWithApplicationLetter(
    applicantId: string,
    jobPostingId: string,
    file: ApplicationLetterFileInput,
  ): Promise<ApplicationWithPosting> {
    return this.db.$transaction(async (tx) => {
      // Client requirement: an applicant scored on one posting shouldn't need
      // a second interview for another posting they apply to afterward - if
      // they already have a scored (or already-inheriting) application,
      // this new one inherits that same score immediately, before it can
      // ever reach a panel's queue.
      const scoreSourceApplicationId = await this.resolveScoreSourceForApplicant(tx, applicantId);
      const application = await tx.application.create({
        // Applications move straight to UNDER_SIFTING on submission - sifting
        // starts automatically, there's no separate manual "start sifting" step.
        data: { applicantId, jobPostingId, status: "UNDER_SIFTING", scoreSourceApplicationId },
      });
      await tx.document.create({
        data: {
          applicantId,
          applicationId: application.id,
          type: "APPLICATION_LETTER",
          fileName: file.fileName,
          filePath: file.filePath,
          mimeType: file.mimeType,
          fileSizeBytes: file.fileSizeBytes,
        },
      });
      return tx.application.findUniqueOrThrow({
        where: { id: application.id },
        include: applicationWithPostingInclude,
      });
    }) as Promise<ApplicationWithPosting>;
  }

  /**
   * The application this applicant's *next* application should inherit its
   * score from, if any already exists - prefers an application that's
   * actually been scored (has its own PanelEvaluation rows) over one that's
   * merely inheriting, and if only an inheriting one exists, resolves
   * through to its own source so scoreSourceApplicationId never chains
   * (always points directly at the one canonical, actually-scored
   * application).
   */
  private async resolveScoreSourceForApplicant(
    tx: Prisma.TransactionClient,
    applicantId: string,
  ): Promise<string | null> {
    const canonical = await tx.application.findFirst({
      where: { applicantId, panelEvaluations: { some: {} } },
      select: { id: true },
      orderBy: { submittedAt: "asc" },
    });
    if (canonical) return canonical.id;

    const inheriting = await tx.application.findFirst({
      where: { applicantId, scoreSourceApplicationId: { not: null } },
      select: { scoreSourceApplicationId: true },
    });
    return inheriting?.scoreSourceApplicationId ?? null;
  }

  findByApplicantAndPosting(applicantId: string, jobPostingId: string): Promise<Application | null> {
    return this.db.application.findUnique({
      where: { applicantId_jobPostingId: { applicantId, jobPostingId } },
    });
  }

  /** Apply-time gate: per client requirement, an applicant can't submit a new application once hired anywhere. */
  async hasHiredApplication(applicantId: string): Promise<boolean> {
    const count = await this.db.application.count({ where: { applicantId, status: "HIRED" } });
    return count > 0;
  }

  findByApplicant(applicantId: string): Promise<ApplicationWithPosting[]> {
    return this.db.application.findMany({
      where: { applicantId },
      include: applicationWithPostingInclude,
      orderBy: { submittedAt: "desc" },
    }) as Promise<ApplicationWithPosting[]>;
  }

  async findById(id: string): Promise<ApplicationWithApplicant | null> {
    const row = await this.db.application.findUnique({
      where: { id },
      include: applicationWithApplicantInclude,
    });
    return row ? toApplicationWithApplicant(row as RawApplicationWithApplicant) : null;
  }

  async findMany(jobPostingId?: string): Promise<ApplicationWithApplicant[]> {
    const rows = await this.db.application.findMany({
      where: jobPostingId ? { jobPostingId } : undefined,
      include: applicationWithApplicantInclude,
      orderBy: { submittedAt: "desc" },
    });
    return (rows as RawApplicationWithApplicant[]).map(toApplicationWithApplicant);
  }

  findByIds(ids: string[]): Promise<Application[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.db.application.findMany({ where: { id: { in: ids } } });
  }

  /**
   * This applicant's other still-open applications, excluding one (the
   * application just hired). Used by markHired() to auto-close them - per
   * client requirement, once hired on one posting, an applicant's other
   * in-flight applications shouldn't linger.
   */
  async findOpenSiblings(applicantId: string, excludeApplicationId: string): Promise<ApplicationWithApplicant[]> {
    const rows = await this.db.application.findMany({
      where: { applicantId, id: { not: excludeApplicationId }, status: { in: [...OPEN_APPLICATION_STATUSES] } },
      include: applicationWithApplicantInclude,
    });
    return (rows as RawApplicationWithApplicant[]).map(toApplicationWithApplicant);
  }

  /** Closes every given application as Not Selected with the same system-generated remarks, in one transaction. */
  async bulkRejectNotSelected(applicationIds: string[], remarks: string): Promise<void> {
    if (applicationIds.length === 0) return;
    const now = new Date();
    await this.db.$transaction(
      applicationIds.map((id) =>
        this.db.application.update({
          where: { id },
          data: { status: "NOT_SELECTED", rejectedAt: now, rejectionRemarks: remarks },
        }),
      ),
    );
  }

  async sift(id: string, input: SiftApplicationInput): Promise<ApplicationWithApplicant> {
    const row = await this.db.application.update({
      where: { id },
      data: {
        siftingRemarks: input.remarks,
        siftedAt: new Date(),
        siftedByUserId: input.siftedByUserId,
        status: input.status,
      },
      include: applicationWithApplicantInclude,
    });
    return toApplicationWithApplicant(row as RawApplicationWithApplicant);
  }

  async withdraw(id: string): Promise<ApplicationWithApplicant> {
    const row = await this.db.application.update({
      where: { id },
      data: { status: "WITHDRAWN", withdrawnAt: new Date() },
      include: applicationWithApplicantInclude,
    });
    return toApplicationWithApplicant(row as RawApplicationWithApplicant);
  }

  async scheduleInterview(id: string, input: ScheduleInterviewInput): Promise<ApplicationWithApplicant> {
    const row = await this.db.application.update({
      where: { id },
      data: {
        status: "FOR_INTERVIEW",
        interviewScheduledAt: input.scheduledAt,
        interviewScheduledEndAt: input.scheduledEndAt,
        interviewVenue: input.venue,
        interviewAttire: input.attire,
        interviewNotes: input.notes,
      },
      include: applicationWithApplicantInclude,
    });
    return toApplicationWithApplicant(row as RawApplicationWithApplicant);
  }

  async moveToCompliance(id: string): Promise<ApplicationWithApplicant> {
    const row = await this.db.application.update({
      where: { id },
      data: { status: "FOR_COMPLIANCE", complianceRequestedAt: new Date() },
      include: applicationWithApplicantInclude,
    });
    return toApplicationWithApplicant(row as RawApplicationWithApplicant);
  }

  async scheduleOathTaking(id: string, input: ScheduleOathTakingInput): Promise<ApplicationWithApplicant> {
    const row = await this.db.application.update({
      where: { id },
      data: {
        status: "FOR_OATH_TAKING",
        complianceCompletedAt: new Date(),
        oathTakingScheduledAt: input.scheduledAt,
        oathTakingVenue: input.venue,
        oathTakingNotes: input.notes,
      },
      include: applicationWithApplicantInclude,
    });
    return toApplicationWithApplicant(row as RawApplicationWithApplicant);
  }

  async markHired(id: string): Promise<ApplicationWithApplicant> {
    const row = await this.db.application.update({
      where: { id },
      data: { status: "HIRED", hiredAt: new Date() },
      include: applicationWithApplicantInclude,
    });
    return toApplicationWithApplicant(row as RawApplicationWithApplicant);
  }

  async rejectAfterInterview(id: string, remarks?: string): Promise<ApplicationWithApplicant> {
    const row = await this.db.application.update({
      where: { id },
      data: { status: "NOT_SELECTED", rejectedAt: new Date(), rejectionRemarks: remarks },
      include: applicationWithApplicantInclude,
    });
    return toApplicationWithApplicant(row as RawApplicationWithApplicant);
  }

  async rejectAfterCompliance(id: string, remarks?: string): Promise<ApplicationWithApplicant> {
    const row = await this.db.application.update({
      where: { id },
      data: { status: "DISQUALIFIED", rejectedAt: new Date(), rejectionRemarks: remarks },
      include: applicationWithApplicantInclude,
    });
    return toApplicationWithApplicant(row as RawApplicationWithApplicant);
  }

  /** Manual, single-application counterpart to bulkSetExaminationScores below (the Excel import path) - same fields, one row at a time. */
  async setExaminationScore(id: string, score: number): Promise<ApplicationWithApplicant> {
    const row = await this.db.application.update({
      where: { id },
      data: { examinationScore: score, examinationScoredAt: new Date() },
      include: applicationWithApplicantInclude,
    });
    return toApplicationWithApplicant(row as RawApplicationWithApplicant);
  }

  async bulkSetExaminationScores(updates: ExaminationScoreUpdate[]): Promise<void> {
    if (updates.length === 0) return;
    const now = new Date();
    await this.db.$transaction(
      updates.map((update) =>
        this.db.application.update({
          where: { id: update.applicationId },
          data: { examinationScore: update.score, examinationScoredAt: now },
        }),
      ),
    );
  }
}
