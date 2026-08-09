import { z } from "zod";

export const uploadDocumentFieldsSchema = z.object({
  type: z.enum([
    "PDS",
    "PDS_EXCEL",
    "IPCR",
    "ELIGIBILITY_PROOF",
    "LD_PROOF",
    "TRANSCRIPT_OF_RECORDS",
    "DIPLOMA",
    "PQE_NOTICE",
    "DESIGNATION_ORDER",
    "AWARD_PROOF",
    "OTHER",
  ]),
  applicationId: z.string().uuid().optional(),
  ldInterventionId: z.string().uuid().optional(),
  awardId: z.string().uuid().optional(),
});
export type UploadDocumentFieldsDto = z.infer<typeof uploadDocumentFieldsSchema>;
