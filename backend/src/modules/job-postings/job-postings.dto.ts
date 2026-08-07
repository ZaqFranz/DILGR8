import { z } from "zod";

export const createJobPostingSchema = z.object({
  title: z.string().min(1).max(200),
  positionLevel: z.enum(["ENTRY", "PROMOTIONAL"]),
  qualificationEducation: z.string().min(1),
  qualificationTraining: z.string().min(1),
  qualificationExperience: z.string().min(1),
  qualificationEligibility: z.string().min(1),
});
export type CreateJobPostingDto = z.infer<typeof createJobPostingSchema>;

export const listJobPostingsQuerySchema = z.object({
  status: z.enum(["OPEN", "CLOSED"]).optional(),
});
export type ListJobPostingsQueryDto = z.infer<typeof listJobPostingsQuerySchema>;
