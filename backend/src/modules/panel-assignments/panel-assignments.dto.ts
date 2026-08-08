import { z } from "zod";

export const createPanelAssignmentSchema = z.object({
  jobPostingId: z.string().uuid(),
  panelUserId: z.string().uuid(),
});
export type CreatePanelAssignmentDto = z.infer<typeof createPanelAssignmentSchema>;

export const listPanelAssignmentsQuerySchema = z.object({
  jobPostingId: z.string().uuid().optional(),
});
export type ListPanelAssignmentsQueryDto = z.infer<typeof listPanelAssignmentsQuerySchema>;
