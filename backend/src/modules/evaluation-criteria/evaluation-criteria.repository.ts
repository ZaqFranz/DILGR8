import type { EvaluationCriterion, EvaluationCriterionQuestion, PrismaClient } from "@prisma/client";

export type EvaluationCriterionWithQuestions = EvaluationCriterion & { questions: EvaluationCriterionQuestion[] };

export interface CreateEvaluationCriterionInput {
  name: string;
  questions?: string[];
  maxScore: number;
  sortOrder?: number;
}

export interface UpdateEvaluationCriterionInput {
  name?: string;
  questions?: string[];
  maxScore?: number;
  sortOrder?: number;
  isActive?: boolean;
}

const questionsInclude = { questions: { orderBy: { sortOrder: "asc" as const } } };

export class EvaluationCriteriaRepository {
  constructor(private readonly db: PrismaClient) {}

  create(input: CreateEvaluationCriterionInput): Promise<EvaluationCriterionWithQuestions> {
    const { questions, ...criterionFields } = input;
    return this.db.evaluationCriterion.create({
      data: {
        ...criterionFields,
        questions: {
          create: (questions ?? []).map((text, index) => ({ text, sortOrder: index })),
        },
      },
      include: questionsInclude,
    });
  }

  findById(id: string): Promise<EvaluationCriterionWithQuestions | null> {
    return this.db.evaluationCriterion.findUnique({ where: { id }, include: questionsInclude });
  }

  findMany(onlyActive: boolean): Promise<EvaluationCriterionWithQuestions[]> {
    return this.db.evaluationCriterion.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      include: questionsInclude,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  async update(id: string, data: UpdateEvaluationCriterionInput): Promise<EvaluationCriterionWithQuestions> {
    const { questions, ...criterionFields } = data;
    return this.db.$transaction(async (tx) => {
      await tx.evaluationCriterion.update({ where: { id }, data: criterionFields });
      if (questions !== undefined) {
        await tx.evaluationCriterionQuestion.deleteMany({ where: { criterionId: id } });
        await tx.evaluationCriterionQuestion.createMany({
          data: questions.map((text, index) => ({ criterionId: id, text, sortOrder: index })),
        });
      }
      return tx.evaluationCriterion.findUniqueOrThrow({ where: { id }, include: questionsInclude });
    });
  }

  delete(id: string): Promise<EvaluationCriterion> {
    return this.db.evaluationCriterion.delete({ where: { id } });
  }

  countScores(id: string): Promise<number> {
    return this.db.panelScore.count({ where: { criterionId: id } });
  }
}
