import type { JobPosting, JobPostingStatus } from "@prisma/client";
import { ConflictError, NotFoundError } from "@/shared/errors/AppError";
import type { AuditLogsRepository } from "@/modules/audit-logs/audit-logs.repository";
import { AuditAction, AuditEntityType } from "@/modules/audit-logs/audit-actions";
import type { JobPostingsRepository, JobPostingWithEligibility } from "./job-postings.repository";
import type { CreateJobPostingDto, UpdateJobPostingDto } from "./job-postings.dto";

const APPLICATION_WINDOW_DAYS = 10;

export class JobPostingsService {
  constructor(
    private readonly jobPostingsRepository: JobPostingsRepository,
    private readonly auditLogsRepository: AuditLogsRepository,
  ) {}

  async create(createdByUserId: string, dto: CreateJobPostingDto): Promise<JobPostingWithEligibility> {
    const postedAt = new Date();
    const closingAt = JobPostingsService.computeClosingAt(postedAt);
    const posting = await this.jobPostingsRepository.create({ ...dto, postedAt, closingAt, createdByUserId });

    await this.auditLogsRepository.record({
      actorUserId: createdByUserId,
      action: AuditAction.JOB_POSTING_CREATED,
      entityType: AuditEntityType.JOB_POSTING,
      entityId: posting.id,
      details: `Posted "${posting.title}"`,
    });

    return posting;
  }

  async findById(id: string): Promise<JobPostingWithEligibility> {
    const posting = await this.jobPostingsRepository.findById(id);
    if (!posting) {
      throw new NotFoundError("Job posting");
    }
    return posting;
  }

  list(status?: JobPostingStatus): Promise<JobPostingWithEligibility[]> {
    return this.jobPostingsRepository.findMany(status);
  }

  async update(actorUserId: string, id: string, dto: UpdateJobPostingDto): Promise<JobPostingWithEligibility> {
    const existing = await this.findById(id);
    const updated = await this.jobPostingsRepository.update(id, dto);

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.JOB_POSTING_UPDATED,
      entityType: AuditEntityType.JOB_POSTING,
      entityId: id,
      details: `Updated "${existing.title}": ${JSON.stringify(dto)}`,
    });

    return updated;
  }

  async remove(actorUserId: string, id: string): Promise<void> {
    const existing = await this.findById(id);

    const applicationCount = await this.jobPostingsRepository.countApplications(id);
    if (applicationCount > 0) {
      throw new ConflictError(
        `Cannot delete a job posting with ${applicationCount} submitted application(s). Close it instead.`,
      );
    }

    await this.jobPostingsRepository.delete(id);

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.JOB_POSTING_DELETED,
      entityType: AuditEntityType.JOB_POSTING,
      entityId: id,
      details: `Deleted "${existing.title}"`,
    });
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
