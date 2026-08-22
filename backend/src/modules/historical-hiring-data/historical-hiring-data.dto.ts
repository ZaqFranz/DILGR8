import { z } from "zod";
import { EDUCATION_LEVEL_VALUES } from "@/shared/constants/educationLevels";

const educationLevelSchema = z.enum(EDUCATION_LEVEL_VALUES);
const eligibilityTypeSchema = z.enum(["RA1080", "CSC_PROFESSIONAL", "CSC_SUBPROFESSIONAL", "BARANGAY", "NONE"]);

const awardInputSchema = z.object({
  title: z.string().min(1).max(200),
});

const ldEntryInputSchema = z.object({
  title: z.string().min(1).max(200),
  hours: z.number().int().positive().max(1000),
});

export const createHistoricalHiringRecordSchema = z.object({
  course: z.string().min(1).max(200),
  educationLevel: educationLevelSchema,
  yearsOfExperience: z.number().int().min(0).max(60),
  previousJobTitle: z.string().min(1).max(200),
  eligibilityType: eligibilityTypeSchema,
  year: z.number().int().min(1900).max(2100),
  wasHired: z.boolean(),
  sourceNote: z.string().max(500).optional(),
  awards: z.array(awardInputSchema).max(100).default([]),
  ldEntries: z.array(ldEntryInputSchema).max(100).default([]),
});
export type CreateHistoricalHiringRecordDto = z.infer<typeof createHistoricalHiringRecordSchema>;

export const updateHistoricalHiringRecordSchema = createHistoricalHiringRecordSchema.partial();
export type UpdateHistoricalHiringRecordDto = z.infer<typeof updateHistoricalHiringRecordSchema>;

// Comma-separated in the query string (?applicationIds=a,b,c) rather than
// repeated keys - simplest to build from the frontend's already-fetched
// list of application ids for one batched lookup.
export const predictHireQuerySchema = z.object({
  applicationIds: z
    .string()
    .min(1)
    .transform((value) => value.split(",").map((id) => id.trim()))
    .pipe(z.array(z.string().uuid()).min(1).max(200)),
});
export type PredictHireQueryDto = z.infer<typeof predictHireQuerySchema>;
