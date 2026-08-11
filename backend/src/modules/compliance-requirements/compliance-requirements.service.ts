import type { ComplianceRequirement } from "@prisma/client";
import { ConflictError, NotFoundError } from "@/shared/errors/AppError";
import type { AuditLogsRepository } from "@/modules/audit-logs/audit-logs.repository";
import { AuditAction, AuditEntityType } from "@/modules/audit-logs/audit-actions";
import type { ComplianceRequirementsRepository } from "./compliance-requirements.repository";
import type { CreateComplianceRequirementDto, UpdateComplianceRequirementDto } from "./compliance-requirements.dto";

export class ComplianceRequirementsService {
  constructor(
    private readonly complianceRequirementsRepository: ComplianceRequirementsRepository,
    private readonly auditLogsRepository: AuditLogsRepository,
  ) {}

  async create(actorUserId: string, dto: CreateComplianceRequirementDto): Promise<ComplianceRequirement> {
    const requirement = await this.complianceRequirementsRepository.create(dto);

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.COMPLIANCE_REQUIREMENT_CREATED,
      entityType: AuditEntityType.COMPLIANCE_REQUIREMENT,
      entityId: requirement.id,
      details: `Added compliance requirement "${requirement.name}"`,
    });

    return requirement;
  }

  async findById(id: string): Promise<ComplianceRequirement> {
    const requirement = await this.complianceRequirementsRepository.findById(id);
    if (!requirement) {
      throw new NotFoundError("Compliance requirement");
    }
    return requirement;
  }

  list(onlyActive: boolean): Promise<ComplianceRequirement[]> {
    return this.complianceRequirementsRepository.findMany(onlyActive);
  }

  async update(actorUserId: string, id: string, dto: UpdateComplianceRequirementDto): Promise<ComplianceRequirement> {
    const existing = await this.findById(id);
    const updated = await this.complianceRequirementsRepository.update(id, dto);

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.COMPLIANCE_REQUIREMENT_UPDATED,
      entityType: AuditEntityType.COMPLIANCE_REQUIREMENT,
      entityId: id,
      details: `Updated "${existing.name}": ${JSON.stringify(dto)}`,
    });

    return updated;
  }

  async remove(actorUserId: string, id: string): Promise<void> {
    const existing = await this.findById(id);

    const itemCount = await this.complianceRequirementsRepository.countItems(id);
    if (itemCount > 0) {
      throw new ConflictError(
        `Cannot delete a requirement with ${itemCount} applicant submission(s). Deactivate it instead.`,
      );
    }

    await this.complianceRequirementsRepository.delete(id);

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.COMPLIANCE_REQUIREMENT_DELETED,
      entityType: AuditEntityType.COMPLIANCE_REQUIREMENT,
      entityId: id,
      details: `Deleted compliance requirement "${existing.name}"`,
    });
  }
}
