import { z } from "zod";

export const uploadDocumentFieldsSchema = z.object({
  type: z.enum(["ELIGIBILITY_PROOF", "IPCR", "DESIGNATION_ORDER", "LD_PROOF", "OTHER"]),
  applicationId: z.string().uuid().optional(),
  ldInterventionId: z.string().uuid().optional(),
});
export type UploadDocumentFieldsDto = z.infer<typeof uploadDocumentFieldsSchema>;
