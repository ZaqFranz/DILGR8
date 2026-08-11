import { z } from "zod";

export const createComplianceRequirementSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  sortOrder: z.number().int().optional(),
});
export type CreateComplianceRequirementDto = z.infer<typeof createComplianceRequirementSchema>;

export const updateComplianceRequirementSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateComplianceRequirementDto = z.infer<typeof updateComplianceRequirementSchema>;
