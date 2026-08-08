import { apiRequest } from "@/shared/api/apiClient";
import type { AdminApplication, EvaluateApplicationInput } from "../types";

export function listApplicationsForAdmin(jobPostingId?: string): Promise<AdminApplication[]> {
  const query = jobPostingId ? `?jobPostingId=${jobPostingId}` : "";
  return apiRequest<AdminApplication[]>(`/applications${query}`);
}

export function evaluateApplication(id: string, input: EvaluateApplicationInput): Promise<AdminApplication> {
  return apiRequest<AdminApplication>(`/applications/${id}/evaluate`, { method: "PATCH", body: input });
}

export function scheduleInterview(id: string): Promise<AdminApplication> {
  return apiRequest<AdminApplication>(`/applications/${id}/schedule-interview`, { method: "PATCH" });
}
