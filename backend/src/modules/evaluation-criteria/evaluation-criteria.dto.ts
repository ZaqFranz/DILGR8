import { z } from "zod";

export const createEvaluationCriterionSchema = z.object({
  name: z.string().min(1).max(200),
  maxScore: z.number().int().min(1).max(1000),
  sortOrder: z.number().int().optional(),
});
export type CreateEvaluationCriterionDto = z.infer<typeof createEvaluationCriterionSchema>;

export const updateEvaluationCriterionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  maxScore: z.number().int().min(1).max(1000).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateEvaluationCriterionDto = z.infer<typeof updateEvaluationCriterionSchema>;
