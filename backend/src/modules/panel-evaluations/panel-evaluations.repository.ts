import type { Application, PanelEvaluation, PanelScore, PrismaClient } from "@prisma/client";

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
  jobPosting: { title: string };
  applicant: { firstName: string; lastName: string };
  panelEvaluations: (PanelEvaluation & { scores: PanelScore[] })[];
};

export type PanelEvaluationWithScores = PanelEvaluation & { scores: PanelScore[] };

export interface UpsertPanelEvaluationInput {
  remarks?: string;
  scores: { criterionId: string; score: number }[];
}

const TABULATION_STATUSES = ["FOR_INTERVIEW", "QUALIFIED", "NOT_QUALIFIED"] as const;

export class PanelEvaluationsRepository {
  constructor(private readonly db: PrismaClient) {}

  findApplicationById(id: string): Promise<Application | null> {
    return this.db.application.findUnique({ where: { id } });
  }

  findQueueForPanelUser(jobPostingIds: string[], panelUserId: string): Promise<ApplicationForInterviewQueue[]> {
    if (jobPostingIds.length === 0) return Promise.resolve([]);
    return this.db.application.findMany({
      where: { jobPostingId: { in: jobPostingIds }, status: "FOR_INTERVIEW" },
      include: {
        jobPosting: { select: { id: true, title: true } },
        applicant: { select: { id: true, firstName: true, lastName: true } },
        panelEvaluations: { where: { panelUserId }, include: { scores: true } },
      },
      orderBy: { submittedAt: "asc" },
    }) as Promise<ApplicationForInterviewQueue[]>;
  }

  findApplicationsForTabulation(jobPostingId: string): Promise<ApplicationForTabulation[]> {
    return this.db.application.findMany({
      where: { jobPostingId, status: { in: [...TABULATION_STATUSES] } },
      include: {
        applicant: { select: { firstName: true, lastName: true } },
        panelEvaluations: { include: { scores: true } },
      },
      orderBy: { submittedAt: "asc" },
    }) as Promise<ApplicationForTabulation[]>;
  }

  /**
   * Every scored application across every job posting currently in the
   * evaluation phase - the source list for the admin's cross-posting
   * "Applicant Scores" view (Evaluation Criteria page). Unlike
   * findApplicationsForTabulation, this isn't scoped to one posting, and
   * only includes applications at least one panelist has actually scored
   * ("some" on panelEvaluations) since an unscored application has nothing
   * to show here.
   */
  findApplicationsWithScores(): Promise<ApplicationForScoresOverview[]> {
    return this.db.application.findMany({
      where: { status: { in: [...TABULATION_STATUSES] }, panelEvaluations: { some: {} } },
      include: {
        jobPosting: { select: { title: true } },
        applicant: { select: { firstName: true, lastName: true } },
        panelEvaluations: { include: { scores: true } },
      },
      orderBy: { submittedAt: "asc" },
    }) as Promise<ApplicationForScoresOverview[]>;
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
}
