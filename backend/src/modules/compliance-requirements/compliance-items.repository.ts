import type { ApplicationComplianceItem, ComplianceItemStatus, ComplianceRequirement, Document, PrismaClient } from "@prisma/client";

export type ApplicationComplianceItemWithDetails = ApplicationComplianceItem & {
  requirement: ComplianceRequirement;
  documents: Document[];
};

export interface ReviewComplianceItemInput {
  status: ComplianceItemStatus;
  remarks?: string;
  reviewedByUserId: string;
}

const detailsInclude = { requirement: true, documents: true };

export class ComplianceItemsRepository {
  constructor(private readonly db: PrismaClient) {}

  /** Snapshots one PENDING item per currently-active requirement - see ApplicationsService.moveToCompliance(). */
  createManyForApplication(applicationId: string, requirementIds: string[]): Promise<{ count: number }> {
    return this.db.applicationComplianceItem.createMany({
      data: requirementIds.map((requirementId) => ({ applicationId, requirementId })),
    });
  }

  findByApplication(applicationId: string): Promise<ApplicationComplianceItemWithDetails[]> {
    return this.db.applicationComplianceItem.findMany({
      where: { applicationId },
      include: detailsInclude,
      orderBy: { requirement: { sortOrder: "asc" } },
    });
  }

  findById(id: string): Promise<ApplicationComplianceItemWithDetails | null> {
    return this.db.applicationComplianceItem.findUnique({ where: { id }, include: detailsInclude });
  }

  countUnverified(applicationId: string): Promise<number> {
    return this.db.applicationComplianceItem.count({
      where: { applicationId, status: { not: "VERIFIED" } },
    });
  }

  update(id: string, input: ReviewComplianceItemInput): Promise<ApplicationComplianceItemWithDetails> {
    return this.db.applicationComplianceItem.update({
      where: { id },
      data: {
        status: input.status,
        remarks: input.remarks,
        reviewedByUserId: input.reviewedByUserId,
        reviewedAt: new Date(),
      },
      include: detailsInclude,
    });
  }
}
