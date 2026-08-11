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

// Bulk-add only (no bulk remove) - assigns every listed panelist to every
// listed posting's board in one call, skipping pairs already assigned.
export const bulkCreatePanelAssignmentsSchema = z.object({
  jobPostingIds: z.array(z.string().uuid()).min(1).max(200),
  panelUserIds: z.array(z.string().uuid()).min(1).max(50),
});
export type BulkCreatePanelAssignmentsDto = z.infer<typeof bulkCreatePanelAssignmentsSchema>;
