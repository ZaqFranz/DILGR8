import type { Application, PanelEvaluation, PanelScore, PrismaClient } from "@prisma/client";
import { OPEN_APPLICATION_STATUSES } from "@/modules/applications/applications.repository";

export type ApplicationForInterviewQueue = Application & {
  jobPosting: { id: string; title: string };
  applicant: { id: string; firstName: string; lastName: string };
  panelEvaluations: (PanelEvaluation & { scores: PanelScore[] })[];
};

export type ApplicationForTabulation = Application & {
  applicant: { firstName: string; lastName: string };
  panelEvaluations: (PanelEvaluation & { scores: PanelScore[] })[];
};

export type ApplicationForScoresOverview = Application & {
  jobPosting: { title: string; publication: string };
  applicant: { firstName: string; lastName: string };
  panelEvaluations: (PanelEvaluation & { scores: PanelScore[] })[];
};

export type PanelEvaluationWithScores = PanelEvaluation & { scores: PanelScore[] };

export interface UpsertPanelEvaluationInput {
  remarks?: string;
  scores: { criterionId: string; score: number }[];
}

const TABULATION_STATUSES = ["FOR_INTERVIEW", "QUALIFIED", "NOT_QUALIFIED"] as const;

// Applications with no evaluations of their own but a scoreSourceApplicationId
// - the canonical application ids a batch lookup needs to resolve. Exported
// pure so it can be unit-tested without a database, same convention as
// PanelEvaluationsService's assignCompetitionRanks/weightedTotalScore.
export function collectScoreSourceIds<T extends { scoreSourceApplicationId: string | null; panelEvaluations: unknown[] }>(
  applications: T[],
): string[] {
  return [
    ...new Set(
      applications
        .filter((a) => a.panelEvaluations.length === 0 && a.scoreSourceApplicationId !== null)
        .map((a) => a.scoreSourceApplicationId as string),
    ),
  ];
}

// Substitutes an inheriting application's empty panelEvaluations with its
// resolved source's (given a pre-fetched id -> evaluations map). An
// application that already has its own evaluations is left untouched even
// if scoreSourceApplicationId happens to be set - its own data always wins.
export function mergeInheritedEvaluations<
  T extends { scoreSourceApplicationId: string | null; panelEvaluations: PanelEvaluationWithScores[] },
>(applications: T[], sourceEvaluationsByApplicationId: Map<string, PanelEvaluationWithScores[]>): T[] {
  return applications.map((application) =>
    application.panelEvaluations.length === 0 && application.scoreSourceApplicationId !== null
      ? {
          ...application,
          panelEvaluations: sourceEvaluationsByApplicationId.get(application.scoreSourceApplicationId) ?? [],
        }
      : application,
  );
}

export class PanelEvaluationsRepository {
  constructor(private readonly db: PrismaClient) {}

  findApplicationById(id: string): Promise<Application | null> {
    return this.db.application.findUnique({ where: { id } });
  }

  findQueueForPanelUser(jobPostingIds: string[], panelUserId: string): Promise<ApplicationForInterviewQueue[]> {
    if (jobPostingIds.length === 0) return Promise.resolve([]);
    return this.db.application.findMany({
      // scoreSourceApplicationId: null excludes applications that already
      // inherit their score from another of the applicant's applications -
      // see collectScoreSourceIds/mergeInheritedEvaluations above. Nobody
      // should be asked to score someone who's already been scored
      // elsewhere.
      where: { jobPostingId: { in: jobPostingIds }, status: "FOR_INTERVIEW", scoreSourceApplicationId: null },
      include: {
        jobPosting: { select: { id: true, title: true } },
        applicant: { select: { id: true, firstName: true, lastName: true } },
        panelEvaluations: { where: { panelUserId }, include: { scores: true } },
      },
      orderBy: { submittedAt: "asc" },
    }) as Promise<ApplicationForInterviewQueue[]>;
  }

  async findApplicationsForTabulation(jobPostingId: string): Promise<ApplicationForTabulation[]> {
    const applications = (await this.db.application.findMany({
      where: { jobPostingId, status: { in: [...TABULATION_STATUSES] } },
      include: {
        applicant: { select: { firstName: true, lastName: true } },
        panelEvaluations: { include: { scores: true } },
      },
      orderBy: { submittedAt: "asc" },
    })) as ApplicationForTabulation[];
    return this.resolveInherited(applications);
  }

  /**
   * Given a batch of applications (each already carrying its own, possibly
   * empty, panelEvaluations), resolves any inherited scores in one extra
   * batched query - not one query per application - so callers never pay an
   * N+1 cost regardless of how many applications inherit a score.
   */
  private async resolveInherited<
    T extends { scoreSourceApplicationId: string | null; panelEvaluations: PanelEvaluationWithScores[] },
  >(applications: T[]): Promise<T[]> {
    const sourceIds = collectScoreSourceIds(applications);
    if (sourceIds.length === 0) return applications;

    const sourceEvaluations = await this.db.panelEvaluation.findMany({
      where: { applicationId: { in: sourceIds } },
      include: { scores: true },
    });
    const byApplicationId = new Map<string, PanelEvaluationWithScores[]>();
    for (const row of sourceEvaluations) {
      byApplicationId.set(row.applicationId, [...(byApplicationId.get(row.applicationId) ?? []), row]);
    }
    return mergeInheritedEvaluations(applications, byApplicationId);
  }

  /**
   * Every scored application across every job posting, at whatever stage
   * it's currently at - the source list for the admin's cross-posting
   * "Applicant Scores" view (Evaluation Criteria page) and the Report
   * Summary page. Unlike findApplicationsForTabulation, this isn't scoped
   * to one posting or to the interview-stage statuses (TABULATION_STATUSES)
   * - once an application has moved on to Compliance, Oath-Taking, HIRED,
   * or even NOT_SELECTED/DISQUALIFIED/WITHDRAWN, its interview scores are
   * still a historical fact worth showing in the report, so the only real
   * filter is "at least one panelist has actually scored it" ("some" on
   * panelEvaluations) - an unscored application has nothing to show here
   * regardless of status. An application with no evaluations of its own but
   * a scoreSourceApplicationId (inherits a score from a sibling application)
   * counts too - the OR below - since it has an effective score even though
   * it has no PanelEvaluation rows of its own; resolveInherited() below
   * fills those in before returning.
   */
  async findApplicationsWithScores(): Promise<ApplicationForScoresOverview[]> {
    const applications = (await this.db.application.findMany({
      where: { OR: [{ panelEvaluations: { some: {} } }, { scoreSourceApplicationId: { not: null } }] },
      include: {
        jobPosting: { select: { title: true, publication: true } },
        applicant: { select: { firstName: true, lastName: true } },
        panelEvaluations: { include: { scores: true } },
      },
      orderBy: { submittedAt: "asc" },
    })) as ApplicationForScoresOverview[];
    return this.resolveInherited(applications);
  }

  findOwnEvaluation(applicationId: string, panelUserId: string): Promise<PanelEvaluationWithScores | null> {
    return this.db.panelEvaluation.findUnique({
      where: { applicationId_panelUserId: { applicationId, panelUserId } },
      include: { scores: true },
    });
  }

  async upsertEvaluation(
    applicationId: string,
    panelUserId: string,
    input: UpsertPanelEvaluationInput,
  ): Promise<PanelEvaluationWithScores> {
    return this.db.$transaction(async (tx) => {
      const evaluation = await tx.panelEvaluation.upsert({
        where: { applicationId_panelUserId: { applicationId, panelUserId } },
        create: { applicationId, panelUserId, remarks: input.remarks ?? null },
        update: { remarks: input.remarks ?? null },
      });
      await tx.panelScore.deleteMany({ where: { panelEvaluationId: evaluation.id } });
      await tx.panelScore.createMany({
        data: input.scores.map((s) => ({
          panelEvaluationId: evaluation.id,
          criterionId: s.criterionId,
          score: s.score,
        })),
      });
      return tx.panelEvaluation.findUniqueOrThrow({
        where: { id: evaluation.id },
        include: { scores: true },
      });
    });
  }

  /**
   * Called right after an application is actually scored (never for one
   * that's itself inheriting - see PanelEvaluationsService.submit()'s guard)
   * - propagates that score to every other of the same applicant's still-open
   * applications that don't already have their own evaluations and aren't
   * already inheriting from somewhere else. Idempotent: safe to call again
   * as additional panelists score the same canonical application, since an
   * already-linked or already-scored sibling is excluded by the where clause.
   */
  async linkSiblingScoreSources(applicantId: string, sourceApplicationId: string): Promise<void> {
    await this.db.application.updateMany({
      where: {
        applicantId,
        id: { not: sourceApplicationId },
        scoreSourceApplicationId: null,
        panelEvaluations: { none: {} },
        status: { in: [...OPEN_APPLICATION_STATUSES] },
      },
      data: { scoreSourceApplicationId: sourceApplicationId },
    });
  }
}
