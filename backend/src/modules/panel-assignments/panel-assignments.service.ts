import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors/AppError";
import type { JobPostingsRepository } from "@/modules/job-postings/job-postings.repository";
import type { UsersRepository } from "@/modules/users/users.repository";
import type { AuditLogsRepository } from "@/modules/audit-logs/audit-logs.repository";
import { AuditAction, AuditEntityType } from "@/modules/audit-logs/audit-actions";
import type { PanelAssignmentsRepository, PanelAssignmentWithPanelUser } from "./panel-assignments.repository";
import type { BulkCreatePanelAssignmentsDto, CreatePanelAssignmentDto } from "./panel-assignments.dto";

export interface BulkCreatePanelAssignmentsResult {
  created: PanelAssignmentWithPanelUser[];
  skippedCount: number;
}

export class PanelAssignmentsService {
  constructor(
    private readonly panelAssignmentsRepository: PanelAssignmentsRepository,
    private readonly jobPostingsRepository: JobPostingsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly auditLogsRepository: AuditLogsRepository,
  ) {}

  list(jobPostingId?: string): Promise<PanelAssignmentWithPanelUser[]> {
    return this.panelAssignmentsRepository.findMany(jobPostingId);
  }

  async create(actorUserId: string, dto: CreatePanelAssignmentDto): Promise<PanelAssignmentWithPanelUser> {
    const posting = await this.jobPostingsRepository.findById(dto.jobPostingId);
    if (!posting) {
      throw new NotFoundError("Job posting");
    }

    const panelUser = await this.usersRepository.findById(dto.panelUserId);
    if (!panelUser) {
      throw new NotFoundError("Panel user");
    }
    if (panelUser.role !== "PANEL") {
      throw new ValidationError("This user does not have the Panel role");
    }

    const existing = await this.panelAssignmentsRepository.findByPostingAndPanelUser(dto.jobPostingId, dto.panelUserId);
    if (existing) {
      throw new ConflictError("This panel member is already assigned to this posting");
    }

    const assignment = await this.panelAssignmentsRepository.create(dto.jobPostingId, dto.panelUserId);

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.PANEL_ASSIGNED,
      entityType: AuditEntityType.PANEL_ASSIGNMENT,
      entityId: assignment.id,
      details: `Assigned ${panelUser.email} to interview panel for "${posting.title}"`,
    });

    return assignment;
  }

  /**
   * Assigns every panel user in `panelUserIds` to every posting in
   * `jobPostingIds`, skipping pairs that are already assigned. Used by the
   * Interview Panel page's "select multiple applicants, assign a panel to
   * all of them at once" bulk action - each selected applicant resolves to
   * its job posting, so this is really "add these panelists to the boards
   * of these postings" (see PanelAssignment's schema comment: assignment is
   * keyed on posting, not on an individual applicant).
   */
  async bulkCreate(actorUserId: string, dto: BulkCreatePanelAssignmentsDto): Promise<BulkCreatePanelAssignmentsResult> {
    const jobPostingIds = [...new Set(dto.jobPostingIds)];
    const panelUserIds = [...new Set(dto.panelUserIds)];

    const [postings, panelUsers, existing] = await Promise.all([
      this.jobPostingsRepository.findByIds(jobPostingIds),
      this.usersRepository.findByIds(panelUserIds),
      this.panelAssignmentsRepository.findManyByPostingAndPanelUserIds(jobPostingIds, panelUserIds),
    ]);

    if (postings.length !== jobPostingIds.length) {
      throw new NotFoundError("Job posting");
    }
    if (panelUsers.length !== panelUserIds.length) {
      throw new NotFoundError("Panel user");
    }
    const nonPanelUser = panelUsers.find((user) => user.role !== "PANEL");
    if (nonPanelUser) {
      throw new ValidationError(`${nonPanelUser.email} does not have the Panel role`);
    }

    const existingKeys = new Set(existing.map((a) => `${a.jobPostingId}:${a.panelUserId}`));
    const pairsToCreate = jobPostingIds.flatMap((jobPostingId) =>
      panelUserIds
        .filter((panelUserId) => !existingKeys.has(`${jobPostingId}:${panelUserId}`))
        .map((panelUserId) => ({ jobPostingId, panelUserId })),
    );
    const totalRequestedPairs = jobPostingIds.length * panelUserIds.length;

    if (pairsToCreate.length === 0) {
      return { created: [], skippedCount: totalRequestedPairs };
    }

    await this.panelAssignmentsRepository.createMany(pairsToCreate);
    const afterCreate = await this.panelAssignmentsRepository.findManyByPostingAndPanelUserIds(
      jobPostingIds,
      panelUserIds,
    );
    const createdKeys = new Set(pairsToCreate.map((p) => `${p.jobPostingId}:${p.panelUserId}`));
    const created = afterCreate.filter((a) => createdKeys.has(`${a.jobPostingId}:${a.panelUserId}`));

    const postingTitleById = new Map(postings.map((p) => [p.id, p.title]));
    await Promise.all(
      created.map((assignment) =>
        this.auditLogsRepository.record({
          actorUserId,
          action: AuditAction.PANEL_ASSIGNED,
          entityType: AuditEntityType.PANEL_ASSIGNMENT,
          entityId: assignment.id,
          details: `Assigned ${assignment.panelUser.email} to interview panel for "${
            postingTitleById.get(assignment.jobPostingId) ?? assignment.jobPostingId
          }"`,
        }),
      ),
    );

    return { created, skippedCount: totalRequestedPairs - created.length };
  }

  async remove(actorUserId: string, id: string): Promise<void> {
    const existing = await this.panelAssignmentsRepository.findById(id);
    if (!existing) {
      throw new NotFoundError("Panel assignment");
    }

    const [posting, panelUser] = await Promise.all([
      this.jobPostingsRepository.findById(existing.jobPostingId),
      this.usersRepository.findById(existing.panelUserId),
    ]);

    await this.panelAssignmentsRepository.delete(id);

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.PANEL_UNASSIGNED,
      entityType: AuditEntityType.PANEL_ASSIGNMENT,
      entityId: id,
      details: `Unassigned ${panelUser?.email ?? "(deleted user)"} from interview panel for "${posting?.title ?? "(deleted posting)"}"`,
    });
  }
}
