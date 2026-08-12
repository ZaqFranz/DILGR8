import { apiRequest } from "@/shared/api/apiClient";
import type { JobPosting } from "@/features/job-postings/types";
import type { ApplicationComplianceItem } from "../types";

export interface Application {
  id: string;
  status:
    | "SUBMITTED"
    | "UNDER_SIFTING"
    | "FOR_INTERVIEW"
    | "QUALIFIED"
    | "NOT_QUALIFIED"
    | "FOR_COMPLIANCE"
    | "NOT_SELECTED"
    | "DISQUALIFIED"
    | "FOR_OATH_TAKING"
    | "HIRED"
    | "WITHDRAWN";
  submittedAt: string;
  examinationScore: number | null;
  interviewScheduledAt: string | null;
  interviewScheduledEndAt: string | null;
  interviewVenue: string | null;
  interviewAttire: string | null;
  interviewNotes: string | null;
  oathTakingScheduledAt: string | null;
  oathTakingVenue: string | null;
  oathTakingNotes: string | null;
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

export function listComplianceItems(applicationId: string): Promise<ApplicationComplianceItem[]> {
  return apiRequest<ApplicationComplianceItem[]>(`/applications/${applicationId}/compliance-items`);
}
