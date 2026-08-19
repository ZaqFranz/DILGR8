import { z } from "zod";
import { SALARY_GRADE_VALUES } from "@/shared/constants/salaryGrades";
import { EDUCATION_LEVEL_VALUES } from "@/shared/constants/educationLevels";

const eligibilityTypeSchema = z.enum(["RA1080", "CSC_PROFESSIONAL", "CSC_SUBPROFESSIONAL", "BARANGAY"]);
// Free text set by the admin (e.g. "ROS-1", "ROS-2") - not a fixed list.
const publicationSchema = z.string().min(1).max(191);
// SG 1-33 only - JobPostingsService derives monthlySalary from this value
// via SALARY_GRADE_MONTHLY_SALARY, so monthlySalary is no longer part of
// either input schema (it's server-computed, never admin-typed) - see
// docs/decisions.md's 2026-08-12 entry.
// Custom errorMap so an unselected/invalid <select> value surfaces a plain
// "Select a salary grade." on the form instead of Zod's default
// "Invalid enum value. Expected '1' | '2' | ... , received ''" message
// leaking straight through getFieldErrors() to the UI.
const salaryGradeSchema = z.enum(SALARY_GRADE_VALUES, {
  errorMap: () => ({ message: "Select a salary grade." }),
});
const educationLevelSchema = z.enum(EDUCATION_LEVEL_VALUES, {
  errorMap: () => ({ message: "Select a valid minimum education level." }),
});

export const createJobPostingSchema = z.object({
  title: z.string().min(1).max(200),
  // The Position this posting is created from - drives auto-assignment of
  // that position's default panel members (see JobPostingsService.create).
  positionId: z.string().uuid(),
  publication: publicationSchema,
  description: z.string().min(1),
  numberOfVacantPositions: z.string().min(1).max(191),
  plantillaNumbers: z.string().min(1),
  salaryGrade: salaryGradeSchema,
  placeOfAssignment: z.string().min(1),
  positionNextInRank: z.string().min(1),
  qualificationEducation: z.string().min(1),
  qualificationTraining: z.string().min(1),
  qualificationExperience: z.string().min(1),
  qualificationEligibility: z.string().min(1),
  requiredEligibilityTypes: z.array(eligibilityTypeSchema).default([]),
  // Structured minimums alongside the free-text qualificationX fields above
  // - optional, since a posting can rely on the free text alone (null = no
  // automatic Sifting hint for that criterion). See schema.prisma's comment
  // on JobPosting for the full rationale.
  minEducationLevel: educationLevelSchema.optional(),
  minYearsExperience: z.number().int().min(0).max(60).optional(),
  minTrainingHours: z.number().int().min(0).max(10000).optional(),
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
  salaryGrade: salaryGradeSchema.optional(),
  placeOfAssignment: z.string().min(1).optional(),
  positionNextInRank: z.string().min(1).optional(),
  qualificationEducation: z.string().min(1).optional(),
  qualificationTraining: z.string().min(1).optional(),
  qualificationExperience: z.string().min(1).optional(),
  qualificationEligibility: z.string().min(1).optional(),
  requiredEligibilityTypes: z.array(eligibilityTypeSchema).optional(),
  minEducationLevel: educationLevelSchema.nullable().optional(),
  minYearsExperience: z.number().int().min(0).max(60).nullable().optional(),
  minTrainingHours: z.number().int().min(0).max(10000).nullable().optional(),
  duties: z.string().min(1).optional(),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
});
export type UpdateJobPostingDto = z.infer<typeof updateJobPostingSchema>;

export const listJobPostingsQuerySchema = z.object({
  status: z.enum(["OPEN", "CLOSED"]).optional(),
});
export type ListJobPostingsQueryDto = z.infer<typeof listJobPostingsQuerySchema>;
