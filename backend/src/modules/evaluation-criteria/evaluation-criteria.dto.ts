import { z } from "zod";

// Sent as a plain ordered array of non-empty question texts - the repository
// always fully replaces a criterion's questions (delete + recreate) rather
// than diffing individual rows, same convention as PanelScore under a
// PanelEvaluation.
const questionsSchema = z.array(z.string().min(1).max(2000)).max(50).optional();

export const createEvaluationCriterionSchema = z.object({
  name: z.string().min(1).max(200),
  questions: questionsSchema,
  maxScore: z.number().int().min(1).max(1000),
  sortOrder: z.number().int().optional(),
});
export type CreateEvaluationCriterionDto = z.infer<typeof createEvaluationCriterionSchema>;

export const updateEvaluationCriterionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  questions: questionsSchema,
  maxScore: z.number().int().min(1).max(1000).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateEvaluationCriterionDto = z.infer<typeof updateEvaluationCriterionSchema>;
