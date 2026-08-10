import { apiRequest } from "@/shared/api/apiClient";
import type { JobPosting } from "@/features/job-postings/types";

export interface Application {
  id: string;
  status: "SUBMITTED" | "UNDER_SIFTING" | "FOR_INTERVIEW" | "QUALIFIED" | "NOT_QUALIFIED" | "WITHDRAWN";
  submittedAt: string;
  examinationScore: number | null;
  interviewScheduledAt: string | null;
  interviewScheduledEndAt: string | null;
  interviewVenue: string | null;
  interviewAttire: string | null;
  interviewNotes: string | null;
  jobPosting: JobPosting;
}

export function submitApplication(jobPostingId: string, applicationLetter: File): Promise<Application> {
  const formData = new FormData();
  formData.append("jobPostingId", jobPostingId);
  formData.append("file", applicationLetter);
  return apiRequest<Application>("/applications", { method: "POST", body: formData, isFormData: true });
}

export function listMyApplications(): Promise<Application[]> {
  return apiRequest<Application[]>("/applications/me");
}

export function withdrawApplication(id: string): Promise<Application> {
  return apiRequest<Application>(`/applications/${id}/withdraw`, { method: "PATCH" });
}
