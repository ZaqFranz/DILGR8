import { apiRequest, apiRequestBlob } from "@/shared/api/apiClient";
import type {
  AddComplianceItemInput,
  AdminApplication,
  ApplicationComplianceItem,
  ComplianceSubmissionType,
  ExamScoreImportResult,
  RejectApplicationInput,
  ReviewComplianceItemInput,
  ScheduleInterviewInput,
  ScheduleOathTakingInput,
  SiftApplicationInput,
} from "../types";

export function listApplicationsForAdmin(jobPostingId?: string): Promise<AdminApplication[]> {
  const query = jobPostingId ? `?jobPostingId=${jobPostingId}` : "";
  return apiRequest<AdminApplication[]>(`/applications${query}`);
}

/** Excel of Qualified applicants still missing a PQE score - same Name/Score/Job Title shape importExamScores() reads, so it can be filled in and re-uploaded directly. */
export function exportPendingPqeScores(jobPostingId?: string): Promise<Blob> {
  const query = jobPostingId ? `?jobPostingId=${jobPostingId}` : "";
  return apiRequestBlob(`/applications/pending-pqe-export${query}`);
}

export function siftApplication(id: string, input: SiftApplicationInput): Promise<AdminApplication> {
  return apiRequest<AdminApplication>(`/applications/${id}/sift`, { method: "PATCH", body: input });
}

export function importExamScores(jobPostingId: string | undefined, file: File): Promise<ExamScoreImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  if (jobPostingId) {
    formData.append("jobPostingId", jobPostingId);
  }
  return apiRequest<ExamScoreImportResult>("/applications/import-exam-scores", {
    method: "POST",
    body: formData,
    isFormData: true,
  });
}

export function scheduleInterview(id: string, input: ScheduleInterviewInput): Promise<AdminApplication> {
  return apiRequest<AdminApplication>(`/applications/${id}/schedule-interview`, { method: "PATCH", body: input });
}

export function setExaminationScore(id: string, score: number): Promise<AdminApplication> {
  return apiRequest<AdminApplication>(`/applications/${id}/exam-score`, { method: "PATCH", body: { score } });
}

export function moveToCompliance(id: string): Promise<AdminApplication> {
  return apiRequest<AdminApplication>(`/applications/${id}/move-to-compliance`, { method: "PATCH" });
}

export function rejectAfterInterview(id: string, input: RejectApplicationInput): Promise<AdminApplication> {
  return apiRequest<AdminApplication>(`/applications/${id}/not-selected`, { method: "PATCH", body: input });
}

export function rejectAfterCompliance(id: string, input: RejectApplicationInput): Promise<AdminApplication> {
  return apiRequest<AdminApplication>(`/applications/${id}/disqualify`, { method: "PATCH", body: input });
}

export function listComplianceItems(applicationId: string): Promise<ApplicationComplianceItem[]> {
  return apiRequest<ApplicationComplianceItem[]>(`/applications/${applicationId}/compliance-items`);
}

export function addComplianceItem(applicationId: string, input: AddComplianceItemInput): Promise<ApplicationComplianceItem> {
  return apiRequest<ApplicationComplianceItem>(`/applications/${applicationId}/compliance-items`, {
    method: "POST",
    body: input,
  });
}

export function reviewComplianceItem(
  applicationId: string,
  itemId: string,
  input: ReviewComplianceItemInput,
): Promise<ApplicationComplianceItem> {
  return apiRequest<ApplicationComplianceItem>(`/applications/${applicationId}/compliance-items/${itemId}`, {
    method: "PATCH",
    body: input,
  });
}

export function setComplianceItemSubmissionType(
  applicationId: string,
  itemId: string,
  submissionType: ComplianceSubmissionType,
): Promise<ApplicationComplianceItem> {
  return apiRequest<ApplicationComplianceItem>(`/applications/${applicationId}/compliance-items/${itemId}/submission-type`, {
    method: "PATCH",
    body: { submissionType },
  });
}

export function scheduleOathTaking(id: string, input: ScheduleOathTakingInput): Promise<AdminApplication> {
  return apiRequest<AdminApplication>(`/applications/${id}/oath-taking`, { method: "PATCH", body: input });
}

export function markHired(id: string): Promise<AdminApplication> {
  return apiRequest<AdminApplication>(`/applications/${id}/hire`, { method: "PATCH" });
}
