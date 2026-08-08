import type { PrismaClient } from "@prisma/client";

export interface JobPostingApplicationCount {
  jobPostingId: string;
  title: string;
  count: number;
}

/**
 * Read-only aggregation queries for the admin dashboard. Deliberately reads
 * User/Applicant/JobPosting/Application directly (like AuditLogsRepository
 * does) rather than going through each feature's own repository - this is a
 * cross-cutting reporting concern, not a write path any other service needs.
 */
export class DashboardRepository {
  constructor(private readonly db: PrismaClient) {}

  countUsersByRole() {
    return this.db.user.groupBy({ by: ["role"], _count: { _all: true } });
  }

  countApplicants(): Promise<number> {
    return this.db.applicant.count();
  }

  countApplicantsRegistrationComplete(): Promise<number> {
    return this.db.applicant.count({ where: { registrationCompletedAt: { not: null } } });
  }

  countJobPostingsByStatus() {
    return this.db.jobPosting.groupBy({ by: ["status"], _count: { _all: true } });
  }

  countApplicationsByStatus() {
    return this.db.application.groupBy({ by: ["status"], _count: { _all: true } });
  }

  async topJobPostingsByApplications(limit: number): Promise<JobPostingApplicationCount[]> {
    const grouped = await this.db.application.groupBy({ by: ["jobPostingId"], _count: { _all: true } });
    if (grouped.length === 0) return [];

    const top = [...grouped].sort((a, b) => b._count._all - a._count._all).slice(0, limit);
    const postings = await this.db.jobPosting.findMany({
      where: { id: { in: top.map((g) => g.jobPostingId) } },
      select: { id: true, title: true },
    });
    const titleById = new Map(postings.map((p) => [p.id, p.title]));

    return top.map((g) => ({
      jobPostingId: g.jobPostingId,
      title: titleById.get(g.jobPostingId) ?? "(deleted posting)",
      count: g._count._all,
    }));
  }
}
