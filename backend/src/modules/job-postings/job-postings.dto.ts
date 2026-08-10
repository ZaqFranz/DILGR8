import { z } from "zod";

const eligibilityTypeSchema = z.enum(["RA1080", "CSC_PROFESSIONAL", "CSC_SUBPROFESSIONAL", "BARANGAY"]);
// Free text set by the admin (e.g. "ROS-1", "ROS-2") - not a fixed list.
const publicationSchema = z.string().min(1).max(191);

export const createJobPostingSchema = z.object({
  title: z.string().min(1).max(200),
  // The Position this posting is created from - drives auto-assignment of
  // that position's default panel members (see JobPostingsService.create).
  positionId: z.string().uuid(),
  publication: publicationSchema,
  description: z.string().min(1),
  numberOfVacantPositions: z.string().min(1).max(191),
  plantillaNumbers: z.string().min(1),
  salaryGrade: z.string().min(1).max(191),
  monthlySalary: z.string().min(1).max(191),
  placeOfAssignment: z.string().min(1),
  positionNextInRank: z.string().min(1),
  qualificationEducation: z.string().min(1),
  qualificationTraining: z.string().min(1),
  qualificationExperience: z.string().min(1),
  qualificationEligibility: z.string().min(1),
  requiredEligibilityTypes: z.array(eligibilityTypeSchema).default([]),
  duties: z.string().min(1),
});
export type CreateJobPostingDto = z.infer<typeof createJobPostingSchema>;

export const updateJobPostingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  positionId: z.string().uuid().optional(),
  publication: publicationSchema.optional(),
  description: z.string().min(1).optional(),
  numberOfVacantPositions: z.string().min(1).max(191).optional(),
  plantillaNumbers: z.string().min(1).optional(),
  salaryGrade: z.string().min(1).max(191).optional(),
  monthlySalary: z.string().min(1).max(191).optional(),
  placeOfAssignment: z.string().min(1).optional(),
  positionNextInRank: z.string().min(1).optional(),
  qualificationEducation: z.string().min(1).optional(),
  qualificationTraining: z.string().min(1).optional(),
  qualificationExperience: z.string().min(1).optional(),
  qualificationEligibility: z.string().min(1).optional(),
  requiredEligibilityTypes: z.array(eligibilityTypeSchema).optional(),
  duties: z.string().min(1).optional(),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
});
export type UpdateJobPostingDto = z.infer<typeof updateJobPostingSchema>;

export const listJobPostingsQuerySchema = z.object({
  status: z.enum(["OPEN", "CLOSED"]).optional(),
});
export type ListJobPostingsQueryDto = z.infer<typeof listJobPostingsQuerySchema>;
