import type { PanelAssignment, PrismaClient } from "@prisma/client";

const panelAssignmentWithPanelUserInclude = {
  panelUser: { select: { id: true, email: true, name: true } },
} as const;

export type PanelAssignmentWithPanelUser = PanelAssignment & {
  panelUser: { id: string; email: string; name: string | null };
};

export class PanelAssignmentsRepository {
  constructor(private readonly db: PrismaClient) {}

  create(jobPostingId: string, panelUserId: string): Promise<PanelAssignmentWithPanelUser> {
    return this.db.panelAssignment.create({
      data: { jobPostingId, panelUserId },
      include: panelAssignmentWithPanelUserInclude,
    }) as Promise<PanelAssignmentWithPanelUser>;
  }

  findById(id: string): Promise<PanelAssignment | null> {
    return this.db.panelAssignment.findUnique({ where: { id } });
  }

  findByPostingAndPanelUser(jobPostingId: string, panelUserId: string): Promise<PanelAssignment | null> {
    return this.db.panelAssignment.findUnique({
      where: { jobPostingId_panelUserId: { jobPostingId, panelUserId } },
    });
  }

  findMany(jobPostingId?: string): Promise<PanelAssignmentWithPanelUser[]> {
    return this.db.panelAssignment.findMany({
      where: jobPostingId ? { jobPostingId } : undefined,
      include: panelAssignmentWithPanelUserInclude,
      orderBy: { assignedAt: "asc" },
    }) as Promise<PanelAssignmentWithPanelUser[]>;
  }

  findJobPostingIdsForPanelUser(panelUserId: string): Promise<{ jobPostingId: string }[]> {
    return this.db.panelAssignment.findMany({
      where: { panelUserId },
      select: { jobPostingId: true },
    });
  }

  delete(id: string): Promise<PanelAssignment> {
    return this.db.panelAssignment.delete({ where: { id } });
  }
}
