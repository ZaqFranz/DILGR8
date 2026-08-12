import { NotFoundError, ValidationError } from "@/shared/errors/AppError";
import type { AuditLogsRepository } from "@/modules/audit-logs/audit-logs.repository";
import { AuditAction, AuditEntityType } from "@/modules/audit-logs/audit-actions";
import type { UsersRepository } from "@/modules/users/users.repository";
import type { PositionsRepository, PositionWithPanelMembers } from "./positions.repository";
import type { CreatePositionDto, UpdatePositionDto } from "./positions.dto";

export class PositionsService {
  constructor(
    private readonly positionsRepository: PositionsRepository,
    private readonly auditLogsRepository: AuditLogsRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  // Mirrors PanelAssignmentsService's create()/bulkCreate() validation - a
  // Position's panelUserIds become real PanelAssignment rows the moment a
  // job posting is created from it (JobPostingsService.autoAssignPanelFromPosition()),
  // so a non-PANEL id here would silently produce an assignment nobody can
  // ever act on (the panel-evaluations routes gate on the caller's own role,
  // not the assignment record). The admin UI's picker already only offers
  // PANEL users, so this is defense-in-depth for direct API calls, not a
  // day-to-day guard.
  private async assertPanelUserIds(panelUserIds: string[] | undefined): Promise<void> {
    if (!panelUserIds || panelUserIds.length === 0) return;
    const users = await this.usersRepository.findByIds(panelUserIds);
    if (users.length !== panelUserIds.length) {
      throw new NotFoundError("Panel user");
    }
    const nonPanelUser = users.find((user) => user.role !== "PANEL");
    if (nonPanelUser) {
      throw new ValidationError(`${nonPanelUser.email} does not have the Panel role`);
    }
  }

  async create(actorUserId: string, dto: CreatePositionDto): Promise<PositionWithPanelMembers> {
    await this.assertPanelUserIds(dto.panelUserIds);
    const position = await this.positionsRepository.create(dto);

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.POSITION_CREATED,
      entityType: AuditEntityType.POSITION,
      entityId: position.id,
      details: `Added position "${position.title}" (${position.panelMembers.length} default panel member(s))`,
    });

    return position;
  }

  async findById(id: string): Promise<PositionWithPanelMembers> {
    const position = await this.positionsRepository.findById(id);
    if (!position) {
      throw new NotFoundError("Position");
    }
    return position;
  }

  list(): Promise<PositionWithPanelMembers[]> {
    return this.positionsRepository.findMany();
  }

  async update(actorUserId: string, id: string, dto: UpdatePositionDto): Promise<PositionWithPanelMembers> {
    const existing = await this.findById(id);
    await this.assertPanelUserIds(dto.panelUserIds);
    const updated = await this.positionsRepository.update(id, dto);

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.POSITION_UPDATED,
      entityType: AuditEntityType.POSITION,
      entityId: id,
      details: `Updated position "${existing.title}": ${JSON.stringify(dto)}`,
    });

    return updated;
  }

  async remove(actorUserId: string, id: string): Promise<void> {
    const existing = await this.findById(id);

    // No delete guard needed - JobPosting.positionId is nullable + SetNull,
    // so postings already created from this position just lose the
    // reference (their title/panel assignments already made are untouched).
    await this.positionsRepository.delete(id);

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.POSITION_DELETED,
      entityType: AuditEntityType.POSITION,
      entityId: id,
      details: `Deleted position "${existing.title}"`,
    });
  }
}
