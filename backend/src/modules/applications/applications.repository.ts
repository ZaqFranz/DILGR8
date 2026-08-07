import type { Application, PrismaClient } from "@prisma/client";

const applicationWithPostingInclude = {
  jobPosting: true,
  documents: true,
} as const;

export type ApplicationWithPosting = Application & {
  jobPosting: NonNullable<Awaited<ReturnType<PrismaClient["jobPosting"]["findUnique"]>>>;
};

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
}
