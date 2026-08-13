import { ForbiddenError, NotFoundError, ValidationError } from "@/shared/errors/AppError";
import type { EvaluationCriteriaRepository } from "@/modules/evaluation-criteria/evaluation-criteria.repository";
import type { PanelAssignmentsRepository } from "@/modules/panel-assignments/panel-assignments.repository";
import type { AuditLogsRepository } from "@/modules/audit-logs/audit-logs.repository";
import { AuditAction, AuditEntityType } from "@/modules/audit-logs/audit-actions";
import type {
  ApplicationForInterviewQueue,
  ApplicationForScoresOverview,
  PanelEvaluationsRepository,
  PanelEvaluationWithScores,
} from "./panel-evaluations.repository";
import type { SubmitPanelEvaluationDto } from "./panel-evaluations.dto";

export interface TabulationRow {
  applicationId: string;
  applicantName: string;
  perPanelist: Record<string, number | null>;
  average: number | null;
  rank: number | null;
  panelistsSubmitted: number;
  panelistsAssigned: number;
}

export interface TabulationResult {
  panelists: { id: string; email: string }[];
  rows: TabulationRow[];
}

export interface ApplicantScoreCriterionColumn {
  id: string;
  name: string;
  maxScore: number;
}

export interface ApplicantScoreRow {
  applicationId: string;
  applicantName: string;
  jobPostingTitle: string;
  perCriterion: Record<string, number | null>;
  total: number | null;
  panelistsSubmitted: number;
}

export interface ApplicantScoresOverview {
  criteria: ApplicantScoreCriterionColumn[];
  rows: ApplicantScoreRow[];
}

function totalScore(evaluation: PanelEvaluationWithScores): number {
  return evaluation.scores.reduce((sum, s) => sum + s.score, 0);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Assigns standard competition ranks (1224...) to `rows` by descending
 * `average`, mutating each row's `rank` in place: rows with an equal
 * average share the same rank, and the next distinct average's rank is its
 * 1-based position in the sorted order - not "previous rank + 1", which
 * would break ties arbitrarily by array order instead of ranking them the
 * same. Rows with a null average (nothing to rank) are left with `rank:
 * null` and excluded from the ranking entirely. Exported standalone so it
 * can be unit-tested without spinning up the full service.
 */
export function assignCompetitionRanks<T extends { average: number | null; rank: number | null }>(rows: T[]): T[] {
  const ranked = [...rows].sort((a, b) => (b.average ?? -1) - (a.average ?? -1));
  let previousAverage: number | null = null;
  ranked.forEach((row, index) => {
    if (row.average === null) return;
    row.rank = row.average === previousAverage ? ranked[index - 1]!.rank : index + 1;
    previousAverage = row.average;
  });
  return rows;
}

export class PanelEvaluationsService {
  constructor(
    private readonly panelEvaluationsRepository: PanelEvaluationsRepository,
    private readonly panelAssignmentsRepository: PanelAssignmentsRepository,
    private readonly evaluationCriteriaRepository: EvaluationCriteriaRepository,
    private readonly auditLogsRepository: AuditLogsRepository,
  ) {}

  async myQueue(panelUserId: string): Promise<ApplicationForInterviewQueue[]> {
    const assignments = await this.panelAssignmentsRepository.findJobPostingIdsForPanelUser(panelUserId);
    const jobPostingIds = assignments.map((a) => a.jobPostingId);
    return this.panelEvaluationsRepository.findQueueForPanelUser(jobPostingIds, panelUserId);
  }

  async submit(applicationId: string, panelUserId: string, dto: SubmitPanelEvaluationDto): Promise<PanelEvaluationWithScores> {
    const application = await this.panelEvaluationsRepository.findApplicationById(applicationId);
    if (!application) {
      throw new NotFoundError("Application");
    }
    if (application.status !== "FOR_INTERVIEW") {
      throw new ValidationError("This application is not currently in the interview stage");
    }
    // Belt-and-suspenders: scheduleInterview() already requires a recorded
    // PQE score before an application can reach FOR_INTERVIEW, so this
    // should be unreachable in practice - kept as an explicit guard so panel
    // scoring never depends solely on that earlier gate holding.
    if (application.examinationScore === null) {
      throw new ValidationError("Cannot score this applicant until a PQE exam score has been recorded");
    }

    const assignment = await this.panelAssignmentsRepository.findByPostingAndPanelUser(
      application.jobPostingId,
      panelUserId,
    );
    if (!assignment) {
      throw new ForbiddenError("You are not assigned to this posting's interview panel");
    }

    const activeCriteria = await this.evaluationCriteriaRepository.findMany(true);
    const criteriaById = new Map(activeCriteria.map((c) => [c.id, c]));

    const missing = activeCriteria.filter((c) => !dto.scores.some((s) => s.criterionId === c.id));
    if (missing.length > 0) {
      throw new ValidationError(`Missing score(s) for: ${missing.map((c) => c.name).join(", ")}`);
    }
    for (const score of dto.scores) {
      const criterion = criteriaById.get(score.criterionId);
      if (!criterion) {
        throw new ValidationError("Score submitted for an unknown or inactive criterion");
      }
      if (score.score > criterion.maxScore) {
        throw new ValidationError(`Score for "${criterion.name}" cannot exceed ${criterion.maxScore}`);
      }
    }

    const evaluation = await this.panelEvaluationsRepository.upsertEvaluation(applicationId, panelUserId, {
      remarks: dto.remarks,
      scores: dto.scores,
    });

    await this.auditLogsRepository.record({
      actorUserId: panelUserId,
      action: AuditAction.PANEL_EVALUATION_SUBMITTED,
      entityType: AuditEntityType.PANEL_EVALUATION,
      entityId: evaluation.id,
      details: `Submitted interview scores for application ${applicationId}: ${totalScore(evaluation)} total`,
    });

    return evaluation;
  }

  async tabulation(jobPostingId: string): Promise<TabulationResult> {
    const [assignments, applications] = await Promise.all([
      this.panelAssignmentsRepository.findMany(jobPostingId),
      this.panelEvaluationsRepository.findApplicationsForTabulation(jobPostingId),
    ]);

    const panelists = assignments.map((a) => a.panelUser);
    const panelUserIds = panelists.map((p) => p.id);

    const rows: TabulationRow[] = applications.map((application) => {
      const perPanelist: Record<string, number | null> = {};
      let sum = 0;
      let submitted = 0;
      for (const panelUserId of panelUserIds) {
        const evaluation = application.panelEvaluations.find((e) => e.panelUserId === panelUserId);
        if (evaluation) {
          const total = totalScore(evaluation);
          perPanelist[panelUserId] = total;
          sum += total;
          submitted += 1;
        } else {
          perPanelist[panelUserId] = null;
        }
      }
      return {
        applicationId: application.id,
        applicantName: `${application.applicant.firstName} ${application.applicant.lastName}`,
        perPanelist,
        average: submitted > 0 ? sum / submitted : null,
        rank: null,
        panelistsSubmitted: submitted,
        panelistsAssigned: panelUserIds.length,
      };
    });

    assignCompetitionRanks(rows);

    return { panelists, rows };
  }

  /**
   * Cross-posting, per-criterion view for the admin's "Applicant Scores"
   * modal (Evaluation Criteria page): every scored application's average
   * score on each active criterion, plus its overall average total -
   * "average" because more than one panelist may have scored the same
   * criterion differently. Ranking by any one of these columns (criterion
   * or overall) is left to the frontend, since which column to rank by is
   * a display choice, not fixed data.
   */
  async applicantScoresOverview(): Promise<ApplicantScoresOverview> {
    const [criteria, applications] = await Promise.all([
      this.evaluationCriteriaRepository.findMany(true),
      this.panelEvaluationsRepository.findApplicationsWithScores(),
    ]);

    const rows: ApplicantScoreRow[] = applications.map((application: ApplicationForScoresOverview) => {
      const perCriterion: Record<string, number | null> = {};
      for (const criterion of criteria) {
        const scoresForCriterion = application.panelEvaluations
          .map((evaluation) => evaluation.scores.find((s) => s.criterionId === criterion.id)?.score)
          .filter((score): score is number => score !== undefined);
        perCriterion[criterion.id] = average(scoresForCriterion);
      }
      return {
        applicationId: application.id,
        applicantName: `${application.applicant.firstName} ${application.applicant.lastName}`,
        jobPostingTitle: application.jobPosting.title,
        perCriterion,
        total: average(application.panelEvaluations.map(totalScore)),
        panelistsSubmitted: application.panelEvaluations.length,
      };
    });

    return {
      criteria: criteria.map((c) => ({ id: c.id, name: c.name, maxScore: c.maxScore })),
      rows,
    };
  }
}
