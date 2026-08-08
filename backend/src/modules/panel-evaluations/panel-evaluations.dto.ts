import { z } from "zod";

export const submitPanelEvaluationSchema = z.object({
  remarks: z.string().max(2000).optional(),
  scores: z
    .array(
      z.object({
        criterionId: z.string().uuid(),
        score: z.number().int().min(0),
      }),
    )
    .min(1),
});
export type SubmitPanelEvaluationDto = z.infer<typeof submitPanelEvaluationSchema>;
