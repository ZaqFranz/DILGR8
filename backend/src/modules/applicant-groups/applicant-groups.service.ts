import { NotFoundError, ValidationError } from "@/shared/errors/AppError";
import type { ApplicationsRepository } from "@/modules/applications/applications.repository";
import type { AuditLogsRepository } from "@/modules/audit-logs/audit-logs.repository";
import { AuditAction, AuditEntityType } from "@/modules/audit-logs/audit-actions";
import type { ApplicantGroupsRepository, ApplicantGroupWithMembers } from "./applicant-groups.repository";
import type { CreateApplicantGroupDto, UpdateApplicantGroupDto } from "./applicant-groups.dto";

export class ApplicantGroupsService {
  constructor(
    private readonly applicantGroupsRepository: ApplicantGroupsRepository,
    private readonly applicationsRepository: ApplicationsRepository,
    private readonly auditLogsRepository: AuditLogsRepository,
  ) {}

  list(): Promise<ApplicantGroupWithMembers[]> {
    return this.applicantGroupsRepository.findMany();
  }

  async create(actorUserId: string, dto: CreateApplicantGroupDto): Promise<ApplicantGroupWithMembers> {
    const applicationIds = [...new Set(dto.applicationIds)];
    await this.assertApplicationsExist(applicationIds);

    const group = await this.applicantGroupsRepository.create({
      name: dto.name,
      description: dto.description,
      applicationIds,
    });

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.APPLICANT_GROUP_CREATED,
      entityType: AuditEntityType.APPLICANT_GROUP,
      entityId: group.id,
      details: `Created group "${group.name}" with ${group.members.length} applicant(s)`,
    });

    return group;
  }

  async update(actorUserId: string, id: string, dto: UpdateApplicantGroupDto): Promise<ApplicantGroupWithMembers> {
    const existing = await this.applicantGroupsRepository.findById(id);
    if (!existing) {
      throw new NotFoundError("Group");
    }

    const applicationIds = dto.applicationIds ? [...new Set(dto.applicationIds)] : undefined;
    if (applicationIds) {
      await this.assertApplicationsExist(applicationIds);
    }

    const group = await this.applicantGroupsRepository.update(id, {
      name: dto.name,
      description: dto.description,
      applicationIds,
    });

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.APPLICANT_GROUP_UPDATED,
      entityType: AuditEntityType.APPLICANT_GROUP,
      entityId: group.id,
      details: `Updated group "${group.name}" (${group.members.length} applicant(s))`,
    });

    return group;
  }

  async remove(actorUserId: string, id: string): Promise<void> {
    const existing = await this.applicantGroupsRepository.findById(id);
    if (!existing) {
      throw new NotFoundError("Group");
    }

    await this.applicantGroupsRepository.delete(id);

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.APPLICANT_GROUP_DELETED,
      entityType: AuditEntityType.APPLICANT_GROUP,
      entityId: id,
      details: `Deleted group "${existing.name}" (${existing.members.length} applicant(s))`,
    });
  }

  private async assertApplicationsExist(applicationIds: string[]): Promise<void> {
    const applications = await this.applicationsRepository.findByIds(applicationIds);
    if (applications.length !== applicationIds.length) {
      throw new ValidationError("One or more selected applicants could not be found");
    }
  }
}
