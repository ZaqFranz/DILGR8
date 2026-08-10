import { z } from "zod";

// Sent as a plain array of PANEL user ids - the repository always fully
// replaces a position's panel members (delete + recreate) rather than
// diffing individual rows, same convention as EvaluationCriterionQuestion.
const panelUserIdsSchema = z.array(z.string().uuid()).max(50).optional();

export const createPositionSchema = z.object({
  title: z.string().min(1).max(200),
  panelUserIds: panelUserIdsSchema,
});
export type CreatePositionDto = z.infer<typeof createPositionSchema>;

export const updatePositionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  panelUserIds: panelUserIdsSchema,
});
export type UpdatePositionDto = z.infer<typeof updatePositionSchema>;
