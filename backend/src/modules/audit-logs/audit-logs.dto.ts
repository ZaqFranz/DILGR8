import { z } from "zod";

export const listAuditLogsQuerySchema = z.object({
  entityType: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(500).default(200),
});
export type ListAuditLogsQueryDto = z.infer<typeof listAuditLogsQuerySchema>;
