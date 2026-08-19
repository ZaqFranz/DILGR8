import type { EducationLevel, EligibilityType, JobPosting, JobPostingStatus, PrismaClient } from "@prisma/client";

export interface CreateJobPostingInput {
  title: string;
  positionId: string;
  publication: string;
  description: string;
  numberOfVacantPositions: string;
  plantillaNumbers: string;
  salaryGrade: string;
  monthlySalary: string;
  placeOfAssignment: string;
  positionNextInRank: string;
  qualificationEducation: string;
  qualificationTraining: string;
  qualificationExperience: string;
  qualificationEligibility: string;
  requiredEligibilityTypes: EligibilityType[];
  minEducationLevel?: EducationLevel;
  minYearsExperience?: number;
  minTrainingHours?: number;
  duties: string;
  postedAt: Date;
  closingAt: Date;
  createdByUserId: string;
}

export interface UpdateJobPostingInput {
  title?: string;
  positionId?: string;
  publication?: string;
  description?: string;
  numberOfVacantPositions?: string;
  plantillaNumbers?: string;
  salaryGrade?: string;
  monthlySalary?: string;
  placeOfAssignment?: string;
  positionNextInRank?: string;
  qualificationEducation?: string;
  qualificationTraining?: string;
  qualificationExperience?: string;
  qualificationEligibility?: string;
  requiredEligibilityTypes?: EligibilityType[];
  minEducationLevel?: EducationLevel | null;
  minYearsExperience?: number | null;
  minTrainingHours?: number | null;
  duties?: string;
  status?: JobPostingStatus;
}

export type JobPostingWithEligibility = JobPosting & { requiredEligibilityTypes: EligibilityType[] };

type JobPostingWithEligibilityRows = JobPosting & { requiredEligibilities: { eligibilityType: EligibilityType }[] };

function toJobPostingWithEligibility(posting: JobPostingWithEligibilityRows): JobPostingWithEligibility {
  const { requiredEligibilities, ...rest } = posting;
  return { ...rest, requiredEligibilityTypes: requiredEligibilities.map((row) => row.eligibilityType) };
}

const WITH_ELIGIBILITY = { include: { requiredEligibilities: true } } as const;

export class JobPostingsRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateJobPostingInput): Promise<JobPostingWithEligibility> {
    const { requiredEligibilityTypes, ...rest } = input;
    const posting = await this.db.jobPosting.create({
      data: {
        ...rest,
        requiredEligibilities: {
          create: requiredEligibilityTypes.map((eligibilityType) => ({ eligibilityType })),
        },
      },
      ...WITH_ELIGIBILITY,
    });
    return toJobPostingWithEligibility(posting);
  }

  async findById(id: string): Promise<JobPostingWithEligibility | null> {
    const posting = await this.db.jobPosting.findUnique({ where: { id }, ...WITH_ELIGIBILITY });
    return posting ? toJobPostingWithEligibility(posting) : null;
  }

  async findMany(status?: JobPostingStatus): Promise<JobPostingWithEligibility[]> {
    const postings = await this.db.jobPosting.findMany({
      where: status ? { status } : undefined,
      orderBy: { postedAt: "desc" },
      ...WITH_ELIGIBILITY,
    });
    return postings.map(toJobPostingWithEligibility);
  }

  async findByIds(ids: string[]): Promise<JobPostingWithEligibility[]> {
    if (ids.length === 0) return [];
    const postings = await this.db.jobPosting.findMany({ where: { id: { in: ids } }, ...WITH_ELIGIBILITY });
    return postings.map(toJobPostingWithEligibility);
  }

  async close(id: string): Promise<JobPostingWithEligibility> {
    const posting = await this.db.jobPosting.update({
      where: { id },
      data: { status: "CLOSED" },
      ...WITH_ELIGIBILITY,
    });
    return toJobPostingWithEligibility(posting);
  }

  async update(id: string, data: UpdateJobPostingInput): Promise<JobPostingWithEligibility> {
    const { requiredEligibilityTypes, ...rest } = data;
    const posting = await this.db.jobPosting.update({
      where: { id },
      data: {
        ...rest,
        ...(requiredEligibilityTypes
          ? {
              requiredEligibilities: {
                deleteMany: {},
                create: requiredEligibilityTypes.map((eligibilityType) => ({ eligibilityType })),
              },
            }
          : {}),
      },
      ...WITH_ELIGIBILITY,
    });
    return toJobPostingWithEligibility(posting);
  }

  delete(id: string): Promise<JobPosting> {
    return this.db.jobPosting.delete({ where: { id } });
  }

  countApplications(id: string): Promise<number> {
    return this.db.application.count({ where: { jobPostingId: id } });
  }
}
