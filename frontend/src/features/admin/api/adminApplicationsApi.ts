import { apiRequest } from "@/shared/api/apiClient";
import type { AdminApplication, ExamScoreImportResult, ScheduleInterviewInput, SiftApplicationInput } from "../types";

export function listApplicationsForAdmin(jobPostingId?: string): Promise<AdminApplication[]> {
  const query = jobPostingId ? `?jobPostingId=${jobPostingId}` : "";
  return apiRequest<AdminApplication[]>(`/applications${query}`);
}

export function siftApplication(id: string, input: SiftApplicationInput): Promise<AdminApplication> {
  return apiRequest<AdminApplication>(`/applications/${id}/sift`, { method: "PATCH", body: input });
}

export function importExamScores(jobPostingId: string, file: File): Promise<ExamScoreImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("jobPostingId", jobPostingId);
  return apiRequest<ExamScoreImportResult>("/applications/import-exam-scores", {
    method: "POST",
    body: formData,
    isFormData: true,
  });
}

export function scheduleInterview(id: string, input: ScheduleInterviewInput): Promise<AdminApplication> {
  return apiRequest<AdminApplication>(`/applications/${id}/schedule-interview`, { method: "PATCH", body: input });
}
