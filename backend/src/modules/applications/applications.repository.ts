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

export interface EvaluateApplicationInput {
  score: number;
  status: ApplicationStatus;
  remarks?: string;
  evaluatedByUserId: string;
}

export class ApplicationsRepository {
  constructor(private readonly db: PrismaClient) {}

  create(applicantId: string, jobPostingId: string): Promise<ApplicationWithPosting> {
    return this.db.application.create({
      data: { applicantId, jobPostingId },
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

  evaluate(id: string, input: EvaluateApplicationInput): Promise<ApplicationWithApplicant> {
    return this.db.application.update({
      where: { id },
      data: {
        evaluationScore: input.score,
        evaluationRemarks: input.remarks,
        evaluatedAt: new Date(),
        evaluatedByUserId: input.evaluatedByUserId,
        status: input.status,
      },
      include: applicationWithApplicantInclude,
    }) as Promise<ApplicationWithApplicant>;
  }

  updateStatus(id: string, status: ApplicationStatus): Promise<ApplicationWithApplicant> {
    return this.db.application.update({
      where: { id },
      data: { status },
      include: applicationWithApplicantInclude,
    }) as Promise<ApplicationWithApplicant>;
  }
}
