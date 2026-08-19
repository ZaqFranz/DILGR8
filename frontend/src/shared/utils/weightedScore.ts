import type { Category, PanelScore } from "@/features/admin/types";

/**
 * Mirrors the backend's weighting rule (see PanelEvaluationsService): a
 * category is worth exactly its own `weightPercent` of the overall
 * evaluation, no matter how many criteria/questions it has or what their
 * raw points sum to. A panelist's raw subtotal for one category - the sum
 * of their scores across just that category's own criteria - is
 * normalized against the category's raw max (`category.maxScore`, the sum
 * of its active criteria's own `maxScore`) and then scaled to
 * `weightPercent`. A category with no active criteria (nothing to
 * normalize against) contributes 0 regardless of its weight.
 */
export function weightedCategoryScore(category: Category, scores: PanelScore[]): number {
  const criterionIds = new Set(category.criteria.map((c) => c.id));
  const rawSubtotal = scores.filter((s) => criterionIds.has(s.criterionId)).reduce((sum, s) => sum + s.score, 0);
  return category.maxScore > 0 ? (rawSubtotal / category.maxScore) * category.weightPercent : 0;
}

/** Sum of every category's weighted contribution - a panelist's overall score for one evaluation, out of `maxWeightedTotal(categories)`. */
export function weightedTotalScore(categories: Category[], scores: PanelScore[]): number {
  return categories.reduce((sum, category) => sum + weightedCategoryScore(category, scores), 0);
}

/** Sum of every category's weightPercent - the ceiling `weightedTotalScore` can reach (100 if the categories are configured to add up to that, but not enforced). */
export function maxWeightedTotal(categories: Category[]): number {
  return categories.reduce((sum, c) => sum + c.weightPercent, 0);
}
