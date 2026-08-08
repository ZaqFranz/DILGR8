import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors/AppError";
import type { JobPostingsRepository } from "@/modules/job-postings/job-postings.repository";
import type { UsersRepository } from "@/modules/users/users.repository";
import type { AuditLogsRepository } from "@/modules/audit-logs/audit-logs.repository";
import { AuditAction, AuditEntityType } from "@/modules/audit-logs/audit-actions";
import type { PanelAssignmentsRepository, PanelAssignmentWithPanelUser } from "./panel-assignments.repository";
import type { CreatePanelAssignmentDto } from "./panel-assignments.dto";

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
