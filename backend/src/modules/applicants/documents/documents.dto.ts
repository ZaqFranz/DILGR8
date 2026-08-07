import { z } from "zod";

export const uploadDocumentFieldsSchema = z.object({
  type: z.enum(["ELIGIBILITY_PROOF", "IPCR", "DESIGNATION_ORDER", "OTHER"]),
  applicationId: z.string().uuid().optional(),
});
export type UploadDocumentFieldsDto = z.infer<typeof uploadDocumentFieldsSchema>;
