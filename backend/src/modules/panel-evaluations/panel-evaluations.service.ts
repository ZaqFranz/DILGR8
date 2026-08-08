import { ForbiddenError, NotFoundError, ValidationError } from "@/shared/errors/AppError";
import type { EvaluationCriteriaRepository } from "@/modules/evaluation-criteria/evaluation-criteria.repository";
import type { PanelAssignmentsRepository } from "@/modules/panel-assignments/panel-assignments.repository";
import type { AuditLogsRepository } from "@/modules/audit-logs/audit-logs.repository";
import { AuditAction, AuditEntityType } from "@/modules/audit-logs/audit-actions";
import type {
  ApplicationForInterviewQueue,
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

function totalScore(evaluation: PanelEvaluationWithScores): number {
  return evaluation.scores.reduce((sum, s) => sum + s.score, 0);
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

    const ranked = [...rows].sort((a, b) => (b.average ?? -1) - (a.average ?? -1));
    let rank = 1;
    for (const row of ranked) {
      if (row.average !== null) {
        row.rank = rank;
        rank += 1;
      }
    }

    return { panelists, rows };
  }
}
