import { z } from "zod";

// One rubric line within a category. `id` present = update that existing
// row in place; `id` absent = create a new one. Anything on file but not
// named here gets removed - unless it already has recorded scores, in
// which case CategoriesRepository.replaceCriteria() blocks the whole
// update (409) rather than silently invalidating a panelist's mark. Unlike
// the old free-text "questions" this replaces, each one now carries its
// own maxScore - the score a panelist gives it directly, not just guidance
// text alongside a category-wide score.
const criterionInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(2000),
  maxScore: z.number().int().min(1).max(1000),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
const criteriaSchema = z.array(criterionInputSchema).max(50).optional();

// The category's authoritative share of the overall evaluation (e.g. 25 =
// 25%) - independent of whatever its criteria's own maxScore values sum
// to. See PanelEvaluationsService's weighted-scoring helpers for how a
// panelist's raw per-criterion scores get normalized against this.
const weightPercentSchema = z.number().int().min(1).max(100);

export const createCategorySchema = z.object({
  name: z.string().min(1).max(200),
  weightPercent: weightPercentSchema,
  criteria: criteriaSchema,
  sortOrder: z.number().int().optional(),
});
export type CreateCategoryDto = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  weightPercent: weightPercentSchema.optional(),
  criteria: criteriaSchema,
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;
