import type { JobPosting, JobPostingStatus } from "@prisma/client";
import { NotFoundError } from "@/shared/errors/AppError";
import type { JobPostingsRepository } from "./job-postings.repository";
import type { CreateJobPostingDto } from "./job-postings.dto";

const APPLICATION_WINDOW_DAYS = 10;

export class JobPostingsService {
  constructor(private readonly jobPostingsRepository: JobPostingsRepository) {}

  async create(createdByUserId: string, dto: CreateJobPostingDto): Promise<JobPosting> {
    const postedAt = new Date();
    const closingAt = JobPostingsService.computeClosingAt(postedAt);
    return this.jobPostingsRepository.create({ ...dto, postedAt, closingAt, createdByUserId });
  }

  async findById(id: string): Promise<JobPosting> {
    const posting = await this.jobPostingsRepository.findById(id);
    if (!posting) {
      throw new NotFoundError("Job posting");
    }
    return posting;
  }

  list(status?: JobPostingStatus): Promise<JobPosting[]> {
    return this.jobPostingsRepository.findMany(status);
  }

  /**
   * Acceptance of applications automatically ends at 11:59:59 PM of day 10
   * from the posting date, per the RSP domain spec.
   */
  static computeClosingAt(postedAt: Date): Date {
    const closingAt = new Date(postedAt);
    closingAt.setDate(closingAt.getDate() + APPLICATION_WINDOW_DAYS);
    closingAt.setHours(23, 59, 59, 999);
    return closingAt;
  }

  static isAcceptingApplications(posting: JobPosting): boolean {
    return posting.status === "OPEN" && posting.closingAt.getTime() >= Date.now();
  }
}
