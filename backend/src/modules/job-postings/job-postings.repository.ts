import type { JobPosting, JobPostingStatus, PrismaClient } from "@prisma/client";

export interface CreateJobPostingInput {
  title: string;
  positionLevel: "ENTRY" | "PROMOTIONAL";
  qualificationEducation: string;
  qualificationTraining: string;
  qualificationExperience: string;
  qualificationEligibility: string;
  postedAt: Date;
  closingAt: Date;
  createdByUserId: string;
}

export class JobPostingsRepository {
  constructor(private readonly db: PrismaClient) {}

  create(input: CreateJobPostingInput): Promise<JobPosting> {
    return this.db.jobPosting.create({ data: input });
  }

  findById(id: string): Promise<JobPosting | null> {
    return this.db.jobPosting.findUnique({ where: { id } });
  }

  findMany(status?: JobPostingStatus): Promise<JobPosting[]> {
    return this.db.jobPosting.findMany({
      where: status ? { status } : undefined,
      orderBy: { postedAt: "desc" },
    });
  }

  close(id: string): Promise<JobPosting> {
    return this.db.jobPosting.update({ where: { id }, data: { status: "CLOSED" } });
  }
}
