import type { AuditLogsRepository } from "@/modules/audit-logs/audit-logs.repository";
import type { DashboardRepository } from "./dashboard.repository";
import { APPLICATION_STATUSES, JOB_POSTING_STATUSES, USER_ROLES, type DashboardSummaryDto } from "./dashboard.dto";

const RECENT_ACTIVITY_LIMIT = 8;
const TOP_JOB_POSTINGS_LIMIT = 5;

/** Fills every known key with 0, then overlays whatever Prisma's groupBy actually returned - groupBy only emits rows for combinations that exist, so an empty status would otherwise be missing rather than zero. */
function tally<K extends string>(
  keys: readonly K[],
  groups: Array<{ _count: { _all: number } }> & Array<Record<string, unknown>>,
  keyField: string,
): Record<K, number> {
  const result = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  for (const group of groups) {
    const key = group[keyField] as K;
    if (key in result) result[key] = group._count._all;
  }
  return result;
}

export class DashboardService {
  constructor(
    private readonly dashboardRepository: DashboardRepository,
    private readonly auditLogsRepository: AuditLogsRepository,
  ) {}

  async getSummary(): Promise<DashboardSummaryDto> {
    const [
      applicantsTotal,
      applicantsComplete,
      usersByRoleRaw,
      jobPostingsByStatusRaw,
      applicationsByStatusRaw,
      topJobPostingsRaw,
      recentActivity,
    ] = await Promise.all([
      this.dashboardRepository.countApplicants(),
      this.dashboardRepository.countApplicantsRegistrationComplete(),
      this.dashboardRepository.countUsersByRole(),
      this.dashboardRepository.countJobPostingsByStatus(),
      this.dashboardRepository.countApplicationsByStatus(),
      this.dashboardRepository.topJobPostingsByApplications(TOP_JOB_POSTINGS_LIMIT),
      this.auditLogsRepository.findMany({}, RECENT_ACTIVITY_LIMIT),
    ]);

    const byRole = tally(USER_ROLES, usersByRoleRaw, "role");
    const byPostingStatus = tally(JOB_POSTING_STATUSES, jobPostingsByStatusRaw, "status");
    const byApplicationStatus = tally(APPLICATION_STATUSES, applicationsByStatusRaw, "status");

    return {
      applicants: { total: applicantsTotal, registrationComplete: applicantsComplete },
      users: {
        total: byRole.ADMIN + byRole.APPLICANT,
        byRole,
      },
      jobPostings: {
        total: byPostingStatus.OPEN + byPostingStatus.CLOSED,
        byStatus: byPostingStatus,
      },
      applications: {
        total: Object.values(byApplicationStatus).reduce((sum, n) => sum + n, 0),
        byStatus: byApplicationStatus,
      },
      topJobPostings: topJobPostingsRaw.map((p) => ({
        jobPostingId: p.jobPostingId,
        title: p.title,
        applicationCount: p.count,
      })),
      recentActivity,
    };
  }
}
