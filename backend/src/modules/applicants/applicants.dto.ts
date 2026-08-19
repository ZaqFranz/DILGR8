import { z } from "zod";
import { EDUCATION_LEVEL_VALUES } from "@/shared/constants/educationLevels";

const eligibilityTypeSchema = z.enum(["RA1080", "CSC_PROFESSIONAL", "CSC_SUBPROFESSIONAL", "BARANGAY", "NONE"]);
// Custom errorMap so an unselected/invalid <select> value surfaces a plain
// "Select your highest educational attainment." instead of Zod's default
// "Invalid enum value. Expected ... , received ''" leaking straight through
// getFieldErrors() to the UI - see job-postings.dto.ts's salaryGradeSchema
// for the same fix.
const educationLevelSchema = z.enum(EDUCATION_LEVEL_VALUES, {
  errorMap: () => ({ message: "Select your highest educational attainment." }),
});

export const createApplicantProfileSchema = z
  .object({
    firstName: z.string().min(1).max(100),
    middleName: z.string().max(100).optional(),
    lastName: z.string().min(1).max(100),
    suffix: z.string().max(20).optional(),
    dateOfBirth: z.coerce.date(),
    sex: z.enum(["MALE", "FEMALE"]),
    civilStatus: z.enum(["SINGLE", "MARRIED", "WIDOWED", "SEPARATED"]),
    address: z.string().min(1).max(255),
    contactNumber: z.string().min(7).max(20),
    hasEligibility: z.boolean(),
    eligibilityType: eligibilityTypeSchema.default("NONE"),
    educationLevel: educationLevelSchema,
    yearsOfExperience: z.number().int().min(0).max(60),
  })
  .refine((data) => !data.hasEligibility || data.eligibilityType !== "NONE", {
    message: "eligibilityType is required when hasEligibility is true",
    path: ["eligibilityType"],
  });
export type CreateApplicantProfileDto = z.infer<typeof createApplicantProfileSchema>;

export const updateApplicantProfileSchema = createApplicantProfileSchema.innerType().partial();
export type UpdateApplicantProfileDto = z.infer<typeof updateApplicantProfileSchema>;

export const createLdInterventionSchema = z.object({
  title: z.string().min(1).max(200),
  dateAttended: z.coerce.date(),
  numberOfHours: z.number().int().positive().max(1000),
  sponsoringAgency: z.string().min(1).max(150),
});
export type CreateLdInterventionDto = z.infer<typeof createLdInterventionSchema>;

export const createAwardSchema = z.object({
  title: z.string().min(1).max(200),
  dateAwarded: z.coerce.date(),
  issuingBody: z.string().min(1).max(150),
});
export type CreateAwardDto = z.infer<typeof createAwardSchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
