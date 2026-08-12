import type { JobPosting, JobPostingStatus } from "@prisma/client";
import { ConflictError, NotFoundError } from "@/shared/errors/AppError";
import type { AuditLogsRepository } from "@/modules/audit-logs/audit-logs.repository";
import { AuditAction, AuditEntityType } from "@/modules/audit-logs/audit-actions";
import type { PanelAssignmentsRepository } from "@/modules/panel-assignments/panel-assignments.repository";
import type { PositionsRepository } from "@/modules/positions/positions.repository";
import { formatMonthlySalary, SALARY_GRADE_MONTHLY_SALARY } from "@/shared/constants/salaryGrades";
import type { JobPostingsRepository, JobPostingWithEligibility } from "./job-postings.repository";
import type { CreateJobPostingDto, UpdateJobPostingDto } from "./job-postings.dto";

const APPLICATION_WINDOW_DAYS = 10;

// dto.salaryGrade is already constrained to SALARY_GRADE_VALUES by
// createJobPostingSchema/updateJobPostingSchema (a zod enum built from this
// same table's keys), so the lookup can't actually miss - the guard is
// defense in depth, not a real runtime path.
function monthlySalaryForGrade(salaryGrade: string): string {
  const amount = SALARY_GRADE_MONTHLY_SALARY[salaryGrade];
  if (amount === undefined) {
    throw new Error(`No monthly salary on file for Salary Grade "${salaryGrade}"`);
  }
  return formatMonthlySalary(amount);
}

export class JobPostingsService {
  constructor(
    private readonly jobPostingsRepository: JobPostingsRepository,
    private readonly auditLogsRepository: AuditLogsRepository,
    private readonly positionsRepository: PositionsRepository,
    private readonly panelAssignmentsRepository: PanelAssignmentsRepository,
  ) {}

  async create(createdByUserId: string, dto: CreateJobPostingDto): Promise<JobPostingWithEligibility> {
    const postedAt = new Date();
    const closingAt = JobPostingsService.computeClosingAt(postedAt);
    const monthlySalary = monthlySalaryForGrade(dto.salaryGrade);
    const posting = await this.jobPostingsRepository.create({
      ...dto,
      monthlySalary,
      postedAt,
      closingAt,
      createdByUserId,
    });

    await this.auditLogsRepository.record({
      actorUserId: createdByUserId,
      action: AuditAction.JOB_POSTING_CREATED,
      entityType: AuditEntityType.JOB_POSTING,
      entityId: posting.id,
      details: `Posted "${posting.title}"`,
    });

    if (dto.positionId) {
      await this.autoAssignPanelFromPosition(createdByUserId, posting, dto.positionId);
    }

    return posting;
  }

  /**
   * A Position carries a pre-made group of default Panel members - picking
   * it when posting a job auto-assigns that group to the new posting's
   * interview board, instead of the admin re-assigning the same panelists
   * by hand every time this position is posted.
   */
  private async autoAssignPanelFromPosition(
    actorUserId: string,
    posting: JobPostingWithEligibility,
    positionId: string,
  ): Promise<void> {
    const position = await this.positionsRepository.findById(positionId);
    if (!position) return;

    for (const member of position.panelMembers) {
      const assignment = await this.panelAssignmentsRepository.create(posting.id, member.panelUserId);
      await this.auditLogsRepository.record({
        actorUserId,
        action: AuditAction.PANEL_ASSIGNED,
        entityType: AuditEntityType.PANEL_ASSIGNMENT,
        entityId: assignment.id,
        details: `Auto-assigned ${assignment.panelUser.email} to interview panel for "${posting.title}" (from position "${position.title}")`,
      });
    }
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
    const updated = await this.jobPostingsRepository.update(id, {
      ...dto,
      ...(dto.salaryGrade ? { monthlySalary: monthlySalaryForGrade(dto.salaryGrade) } : {}),
    });

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
