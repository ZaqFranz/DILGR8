import type { ComplianceRequirement, PrismaClient } from "@prisma/client";
import type { CreateComplianceRequirementDto, UpdateComplianceRequirementDto } from "./compliance-requirements.dto";

export class ComplianceRequirementsRepository {
  constructor(private readonly db: PrismaClient) {}

  create(input: CreateComplianceRequirementDto): Promise<ComplianceRequirement> {
    return this.db.complianceRequirement.create({ data: input });
  }

  findById(id: string): Promise<ComplianceRequirement | null> {
    return this.db.complianceRequirement.findUnique({ where: { id } });
  }

  findMany(onlyActive: boolean): Promise<ComplianceRequirement[]> {
    return this.db.complianceRequirement.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  update(id: string, data: UpdateComplianceRequirementDto): Promise<ComplianceRequirement> {
    return this.db.complianceRequirement.update({ where: { id }, data });
  }

  delete(id: string): Promise<ComplianceRequirement> {
    return this.db.complianceRequirement.delete({ where: { id } });
  }

  countItems(id: string): Promise<number> {
    return this.db.applicationComplianceItem.count({ where: { requirementId: id } });
  }
}
