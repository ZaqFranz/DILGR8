import { apiRequest } from "@/shared/api/apiClient";
import type { JobPosting } from "@/features/job-postings/types";

export interface Application {
  id: string;
  status: "SUBMITTED" | "UNDER_SIFTING" | "QUALIFIED" | "NOT_QUALIFIED" | "WITHDRAWN";
  submittedAt: string;
  jobPosting: JobPosting;
}

export function submitApplication(jobPostingId: string): Promise<Application> {
  return apiRequest<Application>("/applications", { method: "POST", body: { jobPostingId } });
}

export function listMyApplications(): Promise<Application[]> {
  return apiRequest<Application[]>("/applications/me");
}
