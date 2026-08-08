import type { EvaluationCriterion } from "@prisma/client";
import { ConflictError, NotFoundError } from "@/shared/errors/AppError";
import type { AuditLogsRepository } from "@/modules/audit-logs/audit-logs.repository";
import { AuditAction, AuditEntityType } from "@/modules/audit-logs/audit-actions";
import type { EvaluationCriteriaRepository } from "./evaluation-criteria.repository";
import type { CreateEvaluationCriterionDto, UpdateEvaluationCriterionDto } from "./evaluation-criteria.dto";

export class EvaluationCriteriaService {
  constructor(
    private readonly evaluationCriteriaRepository: EvaluationCriteriaRepository,
    private readonly auditLogsRepository: AuditLogsRepository,
  ) {}

  async create(actorUserId: string, dto: CreateEvaluationCriterionDto): Promise<EvaluationCriterion> {
    const criterion = await this.evaluationCriteriaRepository.create(dto);

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.CRITERION_CREATED,
      entityType: AuditEntityType.EVALUATION_CRITERION,
      entityId: criterion.id,
      details: `Added evaluation criterion "${criterion.name}" (max ${criterion.maxScore})`,
    });

    return criterion;
  }

  async findById(id: string): Promise<EvaluationCriterion> {
    const criterion = await this.evaluationCriteriaRepository.findById(id);
    if (!criterion) {
      throw new NotFoundError("Evaluation criterion");
    }
    return criterion;
  }

  list(onlyActive: boolean): Promise<EvaluationCriterion[]> {
    return this.evaluationCriteriaRepository.findMany(onlyActive);
  }

  async update(actorUserId: string, id: string, dto: UpdateEvaluationCriterionDto): Promise<EvaluationCriterion> {
    const existing = await this.findById(id);
    const updated = await this.evaluationCriteriaRepository.update(id, dto);

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.CRITERION_UPDATED,
      entityType: AuditEntityType.EVALUATION_CRITERION,
      entityId: id,
      details: `Updated "${existing.name}": ${JSON.stringify(dto)}`,
    });

    return updated;
  }

  async remove(actorUserId: string, id: string): Promise<void> {
    const existing = await this.findById(id);

    const scoreCount = await this.evaluationCriteriaRepository.countScores(id);
    if (scoreCount > 0) {
      throw new ConflictError(
        `Cannot delete a criterion with ${scoreCount} recorded score(s). Deactivate it instead.`,
      );
    }

    await this.evaluationCriteriaRepository.delete(id);

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.CRITERION_DELETED,
      entityType: AuditEntityType.EVALUATION_CRITERION,
      entityId: id,
      details: `Deleted evaluation criterion "${existing.name}"`,
    });
  }
}
