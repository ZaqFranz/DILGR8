import type { Application, ApplicationStatus, EligibilityType, LdIntervention, PrismaClient } from "@prisma/client";

const applicationWithPostingInclude = {
  jobPosting: true,
  documents: true,
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
      const application = await tx.application.create({
        // Applications move straight to UNDER_SIFTING on submission - sifting
        // starts automatically, there's no separate manual "start sifting" step.
        data: { applicantId, jobPostingId, status: "UNDER_SIFTING" },
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

  findByApplicantAndPosting(applicantId: string, jobPostingId: string): Promise<Application | null> {
    return this.db.application.findUnique({
      where: { applicantId_jobPostingId: { applicantId, jobPostingId } },
    });
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
