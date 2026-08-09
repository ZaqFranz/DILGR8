import type { Application, ApplicationStatus, PrismaClient } from "@prisma/client";

const applicationWithPostingInclude = {
  jobPosting: true,
  documents: true,
} as const;

const applicationWithApplicantInclude = {
  jobPosting: true,
  applicant: {
    include: {
      user: { select: { email: true } },
    },
  },
} as const;

export type ApplicationWithPosting = Application & {
  jobPosting: NonNullable<Awaited<ReturnType<PrismaClient["jobPosting"]["findUnique"]>>>;
};

export type ApplicationWithApplicant = Application & {
  jobPosting: NonNullable<Awaited<ReturnType<PrismaClient["jobPosting"]["findUnique"]>>>;
  applicant: NonNullable<Awaited<ReturnType<PrismaClient["applicant"]["findUnique"]>>> & {
    user: { email: string };
  };
};

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
  venue: string;
  attire?: string;
  notes?: string;
}

export class ApplicationsRepository {
  constructor(private readonly db: PrismaClient) {}

  create(applicantId: string, jobPostingId: string): Promise<ApplicationWithPosting> {
    return this.db.application.create({
      // Applications move straight to UNDER_SIFTING on submission - sifting
      // starts automatically, there's no separate manual "start sifting" step.
      data: { applicantId, jobPostingId, status: "UNDER_SIFTING" },
      include: applicationWithPostingInclude,
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

  findById(id: string): Promise<ApplicationWithApplicant | null> {
    return this.db.application.findUnique({
      where: { id },
      include: applicationWithApplicantInclude,
    }) as Promise<ApplicationWithApplicant | null>;
  }

  findMany(jobPostingId?: string): Promise<ApplicationWithApplicant[]> {
    return this.db.application.findMany({
      where: jobPostingId ? { jobPostingId } : undefined,
      include: applicationWithApplicantInclude,
      orderBy: { submittedAt: "desc" },
    }) as Promise<ApplicationWithApplicant[]>;
  }

  sift(id: string, input: SiftApplicationInput): Promise<ApplicationWithApplicant> {
    return this.db.application.update({
      where: { id },
      data: {
        siftingRemarks: input.remarks,
        siftedAt: new Date(),
        siftedByUserId: input.siftedByUserId,
        status: input.status,
      },
      include: applicationWithApplicantInclude,
    }) as Promise<ApplicationWithApplicant>;
  }

  withdraw(id: string): Promise<ApplicationWithApplicant> {
    return this.db.application.update({
      where: { id },
      data: { status: "WITHDRAWN", withdrawnAt: new Date() },
      include: applicationWithApplicantInclude,
    }) as Promise<ApplicationWithApplicant>;
  }

  scheduleInterview(id: string, input: ScheduleInterviewInput): Promise<ApplicationWithApplicant> {
    return this.db.application.update({
      where: { id },
      data: {
        status: "FOR_INTERVIEW",
        interviewScheduledAt: input.scheduledAt,
        interviewVenue: input.venue,
        interviewAttire: input.attire,
        interviewNotes: input.notes,
      },
      include: applicationWithApplicantInclude,
    }) as Promise<ApplicationWithApplicant>;
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
