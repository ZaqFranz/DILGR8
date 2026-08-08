import { apiRequest } from "@/shared/api/apiClient";
import type { PanelAssignment } from "../types";

export function listPanelAssignments(jobPostingId: string): Promise<PanelAssignment[]> {
  return apiRequest<PanelAssignment[]>(`/panel-assignments?jobPostingId=${encodeURIComponent(jobPostingId)}`);
}

export function createPanelAssignment(jobPostingId: string, panelUserId: string): Promise<PanelAssignment> {
  return apiRequest<PanelAssignment>("/panel-assignments", { method: "POST", body: { jobPostingId, panelUserId } });
}

export function deletePanelAssignment(id: string): Promise<void> {
  return apiRequest<void>(`/panel-assignments/${id}`, { method: "DELETE" });
}
