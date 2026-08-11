import { z } from "zod";

const eligibilityTypeSchema = z.enum(["RA1080", "CSC_PROFESSIONAL", "CSC_SUBPROFESSIONAL", "BARANGAY", "NONE"]);

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
