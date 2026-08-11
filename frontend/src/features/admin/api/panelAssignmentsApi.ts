import { apiRequest } from "@/shared/api/apiClient";
import type { BulkAssignPanelResult, PanelAssignment } from "../types";

export function listPanelAssignments(jobPostingId: string): Promise<PanelAssignment[]> {
  return apiRequest<PanelAssignment[]>(`/panel-assignments?jobPostingId=${encodeURIComponent(jobPostingId)}`);
}

export function createPanelAssignment(jobPostingId: string, panelUserId: string): Promise<PanelAssignment> {
  return apiRequest<PanelAssignment>("/panel-assignments", { method: "POST", body: { jobPostingId, panelUserId } });
}

export function bulkCreatePanelAssignments(
  jobPostingIds: string[],
  panelUserIds: string[],
): Promise<BulkAssignPanelResult> {
  return apiRequest<BulkAssignPanelResult>("/panel-assignments/bulk", {
    method: "POST",
    body: { jobPostingIds, panelUserIds },
  });
}

export function deletePanelAssignment(id: string): Promise<void> {
  return apiRequest<void>(`/panel-assignments/${id}`, { method: "DELETE" });
}
