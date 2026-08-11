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

  findManyByPostingAndPanelUserIds(
    jobPostingIds: string[],
    panelUserIds: string[],
  ): Promise<PanelAssignmentWithPanelUser[]> {
    return this.db.panelAssignment.findMany({
      where: { jobPostingId: { in: jobPostingIds }, panelUserId: { in: panelUserIds } },
      include: panelAssignmentWithPanelUserInclude,
      orderBy: { assignedAt: "asc" },
    }) as Promise<PanelAssignmentWithPanelUser[]>;
  }

  /**
   * Bulk-insert (posting, panelist) pairs the service has already confirmed
   * don't exist yet. `skipDuplicates` is just a race-safety net, not the
   * primary de-dup mechanism - the service diffs against existing rows first
   * so it knows exactly which pairs were newly created for the audit trail.
   */
  async createMany(pairs: { jobPostingId: string; panelUserId: string }[]): Promise<void> {
    if (pairs.length === 0) return;
    await this.db.panelAssignment.createMany({ data: pairs, skipDuplicates: true });
  }

  findJobPostingIdsForPanelUser(panelUserId: string): Promise<{ jobPostingId: string }[]> {
    return this.db.panelAssignment.findMany({
      where: { panelUserId },
      select: { jobPostingId: true },
    });
  }

  /**
   * Whether this panel user currently has the applicant's interview-stage
   * application on one of their assigned boards - the scoping check for
   * letting a panelist view that applicant's PDS while interviewing them,
   * without opening every applicant's documents to every panelist.
   */
  async isPanelUserAssignedToApplicant(panelUserId: string, applicantId: string): Promise<boolean> {
    const count = await this.db.application.count({
      where: {
        applicantId,
        status: "FOR_INTERVIEW",
        jobPosting: { panelAssignments: { some: { panelUserId } } },
      },
    });
    return count > 0;
  }

  delete(id: string): Promise<PanelAssignment> {
    return this.db.panelAssignment.delete({ where: { id } });
  }
}
