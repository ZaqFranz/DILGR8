import { z } from "zod";

export const createApplicationSchema = z.object({
  jobPostingId: z.string().uuid(),
});
export type CreateApplicationDto = z.infer<typeof createApplicationSchema>;

export const listApplicationsQuerySchema = z.object({
  jobPostingId: z.string().uuid().optional(),
});
export type ListApplicationsQueryDto = z.infer<typeof listApplicationsQuerySchema>;

// Mandatory fields (score, decision) + score threshold, per the RSP domain
// spec's evaluation-form input validation requirements.
export const evaluateApplicationSchema = z.object({
  score: z.number().int().min(0).max(100),
  decision: z.enum(["QUALIFIED", "NOT_QUALIFIED"]),
  remarks: z.string().max(2000).optional(),
});
export type EvaluateApplicationDto = z.infer<typeof evaluateApplicationSchema>;
