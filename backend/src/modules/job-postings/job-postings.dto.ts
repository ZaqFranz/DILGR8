import { z } from "zod";

export const createJobPostingSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  monthlySalary: z.string().min(1).max(191),
  placeOfAssignment: z.string().min(1),
  positionLevel: z.enum(["ENTRY", "PROMOTIONAL"]),
  qualificationEducation: z.string().min(1),
  qualificationTraining: z.string().min(1),
  qualificationExperience: z.string().min(1),
  qualificationEligibility: z.string().min(1),
  duties: z.string().min(1),
});
export type CreateJobPostingDto = z.infer<typeof createJobPostingSchema>;

export const updateJobPostingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  monthlySalary: z.string().min(1).max(191).optional(),
  placeOfAssignment: z.string().min(1).optional(),
  positionLevel: z.enum(["ENTRY", "PROMOTIONAL"]).optional(),
  qualificationEducation: z.string().min(1).optional(),
  qualificationTraining: z.string().min(1).optional(),
  qualificationExperience: z.string().min(1).optional(),
  qualificationEligibility: z.string().min(1).optional(),
  duties: z.string().min(1).optional(),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
});
export type UpdateJobPostingDto = z.infer<typeof updateJobPostingSchema>;

export const listJobPostingsQuerySchema = z.object({
  status: z.enum(["OPEN", "CLOSED"]).optional(),
});
export type ListJobPostingsQueryDto = z.infer<typeof listJobPostingsQuerySchema>;
