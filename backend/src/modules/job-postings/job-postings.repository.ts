import type { JobPosting, JobPostingStatus, PositionLevel, PrismaClient } from "@prisma/client";

export interface CreateJobPostingInput {
  title: string;
  description: string;
  monthlySalary: string;
  placeOfAssignment: string;
  positionLevel: "ENTRY" | "PROMOTIONAL";
  qualificationEducation: string;
  qualificationTraining: string;
  qualificationExperience: string;
  qualificationEligibility: string;
  duties: string;
  postedAt: Date;
  closingAt: Date;
  createdByUserId: string;
}

export interface UpdateJobPostingInput {
  title?: string;
  description?: string;
  monthlySalary?: string;
  placeOfAssignment?: string;
  positionLevel?: PositionLevel;
  qualificationEducation?: string;
  qualificationTraining?: string;
  qualificationExperience?: string;
  qualificationEligibility?: string;
  duties?: string;
  status?: JobPostingStatus;
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

  update(id: string, data: UpdateJobPostingInput): Promise<JobPosting> {
    return this.db.jobPosting.update({ where: { id }, data });
  }

  delete(id: string): Promise<JobPosting> {
    return this.db.jobPosting.delete({ where: { id } });
  }

  countApplications(id: string): Promise<number> {
    return this.db.application.count({ where: { jobPostingId: id } });
  }
}
