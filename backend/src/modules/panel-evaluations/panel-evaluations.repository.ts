import type { Application, PanelEvaluation, PanelScore, PrismaClient } from "@prisma/client";
import { OPEN_APPLICATION_STATUSES } from "@/modules/applications/applications.repository";

export type ApplicationForInterviewQueue = Application & {
  jobPosting: { id: string; title: string };
  applicant: { id: string; firstName: string; lastName: string };
  panelEvaluations: (PanelEvaluation & { scores: PanelScore[] })[];
  // Every other application (any status) this same applicant has on file,
  // added 2026-08-21 so a panelist isn't confused if they ever do see two
  // queue entries for the same person (the narrow pre-scoring window where
  // both siblings are still genuinely unlinked - see
  // repairAndExcludeAlreadyScoredElsewhere below, which only closes the gap
  // once one of them is actually scored). Informational only - this list
  // doesn't change queue membership or scoring behavior.
  otherApplications: { jobPostingTitle: string }[];
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

// Given a batch of unlinked FOR_INTERVIEW queue candidates and, per
// applicant, the earliest-submitted canonical application id that's since
// been scored (if any), splits candidates into ones that need linking to
// that canonical id (self-healing a sibling that got left behind by the
// race window described on repairAndExcludeAlreadyScoredElsewhere below)
// versus ones that genuinely still need their own interview. Pure so the
// decision itself can be unit-tested without a database, same convention
// as collectScoreSourceIds/mergeInheritedEvaluations above.
export function partitionQueueCandidatesToRepair<T extends { id: string; applicantId: string }>(
  candidates: T[],
  canonicalIdByApplicant: Map<string, string>,
): { toLink: { candidateId: string; canonicalId: string }[]; stillNeedsScoring: T[] } {
  const toLink: { candidateId: string; canonicalId: string }[] = [];
  const stillNeedsScoring: T[] = [];
  for (const candidate of candidates) {
    const canonicalId = canonicalIdByApplicant.get(candidate.applicantId);
    if (canonicalId && canonicalId !== candidate.id) {
      toLink.push({ candidateId: candidate.id, canonicalId });
    } else {
      stillNeedsScoring.push(candidate);
    }
  }
  return { toLink, stillNeedsScoring };
}

export class PanelEvaluationsRepository {
  constructor(private readonly db: PrismaClient) {}

  findApplicationById(id: string): Promise<Application | null> {
    return this.db.application.findUnique({ where: { id } });
  }

  async findQueueForPanelUser(jobPostingIds: string[], panelUserId: string): Promise<ApplicationForInterviewQueue[]> {
    if (jobPostingIds.length === 0) return [];
    const candidates = (await this.db.application.findMany({
      // scoreSourceApplicationId: null excludes applications that already
      // inherit their score from another of the applicant's applications -
      // see collectScoreSourceIds/mergeInheritedEvaluations above. Nobody
      // should be asked to score someone who's already been scored
      // elsewhere. This alone isn't airtight, though - see the repair pass
      // below.
      where: { jobPostingId: { in: jobPostingIds }, status: "FOR_INTERVIEW", scoreSourceApplicationId: null },
      include: {
        jobPosting: { select: { id: true, title: true } },
        applicant: { select: { id: true, firstName: true, lastName: true } },
        panelEvaluations: { where: { panelUserId }, include: { scores: true } },
      },
      orderBy: { submittedAt: "asc" },
    })) as Omit<ApplicationForInterviewQueue, "otherApplications">[];
    const repaired = await this.repairAndExcludeAlreadyScoredElsewhere(candidates);
    return this.attachOtherApplications(repaired);
  }

  /**
   * Batched (one query, not one per candidate) lookup of every other
   * application - any status, any posting - each candidate's applicant has
   * on file, purely for the "Also applied to: ..." hint on My Interviews.
   */
  private async attachOtherApplications<T extends { id: string; applicantId: string }>(
    candidates: T[],
  ): Promise<(T & { otherApplications: { jobPostingTitle: string }[] })[]> {
    if (candidates.length === 0) return [];

    const applicantIds = [...new Set(candidates.map((c) => c.applicantId))];
    const allApplications = await this.db.application.findMany({
      where: { applicantId: { in: applicantIds } },
      select: { id: true, applicantId: true, jobPosting: { select: { title: true } } },
      orderBy: { submittedAt: "asc" },
    });
    const byApplicant = new Map<string, typeof allApplications>();
    for (const row of allApplications) {
      byApplicant.set(row.applicantId, [...(byApplicant.get(row.applicantId) ?? []), row]);
    }

    return candidates.map((candidate) => ({
      ...candidate,
      otherApplications: (byApplicant.get(candidate.applicantId) ?? [])
        .filter((row) => row.id !== candidate.id)
        .map((row) => ({ jobPostingTitle: row.jobPosting.title })),
    }));
  }

  /**
   * Closes a real gap in the two event-driven linking points
   * (createWithApplicationLetter/linkSiblingScoreSources): if an applicant
   * applies to two postings *before either is scored*, neither has anything
   * to link to yet - both can independently reach FOR_INTERVIEW and sit in
   * two different panels' queues unlinked. If one of them gets scored
   * first, `linkSiblingScoreSources` fixes the *other* one going forward,
   * but only from that moment on - a queue fetched in the meantime, or one
   * fetched for a sibling that was scored without that propagation ever
   * having a chance to run, would still show it as needing its own
   * interview (the "duplicate interviews" bug this fixes). Re-checks every
   * queue candidate against the applicant's other applications for one
   * that's since been scored - since discovered - and self-heals the link
   * (same operation linkSiblingScoreSources does reactively) before
   * excluding it, in one batched pass rather than one query per candidate.
   */
  private async repairAndExcludeAlreadyScoredElsewhere<
    T extends { id: string; applicantId: string },
  >(candidates: T[]): Promise<T[]> {
    if (candidates.length === 0) return candidates;

    const applicantIds = [...new Set(candidates.map((c) => c.applicantId))];
    const scoredElsewhere = await this.db.application.findMany({
      where: { applicantId: { in: applicantIds }, panelEvaluations: { some: {} } },
      orderBy: { submittedAt: "asc" },
      select: { id: true, applicantId: true },
    });
    const canonicalByApplicant = new Map<string, string>();
    for (const row of scoredElsewhere) {
      if (!canonicalByApplicant.has(row.applicantId)) canonicalByApplicant.set(row.applicantId, row.id);
    }
    if (canonicalByApplicant.size === 0) return candidates;

    const { toLink, stillNeedsScoring } = partitionQueueCandidatesToRepair(candidates, canonicalByApplicant);
    if (toLink.length > 0) {
      await this.db.$transaction(
        toLink.map(({ candidateId, canonicalId }) =>
          this.db.application.update({ where: { id: candidateId }, data: { scoreSourceApplicationId: canonicalId } }),
        ),
      );
    }
    return stillNeedsScoring;
  }

  /**
   * The write-time counterpart to the queue repair above - called from
   * PanelEvaluationsService.submit() right before actually recording a
   * score, to close the same race for whoever gets to their queue and
   * clicks Score first. Fresh query, not relying on the application's own
   * (possibly stale) scoreSourceApplicationId field: if the applicant has
   * since been scored on a sibling application, links this one to it and
   * returns true (submit() refuses the direct score) instead of letting a
   * second independent evaluation get created for the same person.
   */
  async reconcileScoreSource(applicationId: string, applicantId: string): Promise<boolean> {
    const canonical = await this.db.application.findFirst({
      where: { applicantId, id: { not: applicationId }, panelEvaluations: { some: {} } },
      orderBy: { submittedAt: "asc" },
      select: { id: true },
    });
    if (!canonical) return false;
    await this.db.application.update({ where: { id: applicationId }, data: { scoreSourceApplicationId: canonical.id } });
    return true;
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
