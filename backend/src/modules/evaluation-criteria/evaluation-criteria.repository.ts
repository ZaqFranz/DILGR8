import type { EvaluationCriterion, PrismaClient } from "@prisma/client";

export interface CreateEvaluationCriterionInput {
  name: string;
  maxScore: number;
  sortOrder?: number;
}

export interface UpdateEvaluationCriterionInput {
  name?: string;
  maxScore?: number;
  sortOrder?: number;
  isActive?: boolean;
}

export class EvaluationCriteriaRepository {
  constructor(private readonly db: PrismaClient) {}

  create(input: CreateEvaluationCriterionInput): Promise<EvaluationCriterion> {
    return this.db.evaluationCriterion.create({ data: input });
  }

  findById(id: string): Promise<EvaluationCriterion | null> {
    return this.db.evaluationCriterion.findUnique({ where: { id } });
  }

  findMany(onlyActive: boolean): Promise<EvaluationCriterion[]> {
    return this.db.evaluationCriterion.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  update(id: string, data: UpdateEvaluationCriterionInput): Promise<EvaluationCriterion> {
    return this.db.evaluationCriterion.update({ where: { id }, data });
  }

  delete(id: string): Promise<EvaluationCriterion> {
    return this.db.evaluationCriterion.delete({ where: { id } });
  }

  countScores(id: string): Promise<number> {
    return this.db.panelScore.count({ where: { criterionId: id } });
  }
}
