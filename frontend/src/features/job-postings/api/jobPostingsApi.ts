import { apiRequest } from "@/shared/api/apiClient";
import type { CreateJobPostingInput, JobPosting, JobPostingStatus, UpdateJobPostingInput } from "../types";

export function listJobPostings(status?: JobPostingStatus): Promise<JobPosting[]> {
  const query = status ? `?status=${status}` : "";
  return apiRequest<JobPosting[]>(`/job-postings${query}`);
}

export function getJobPosting(id: string): Promise<JobPosting> {
  return apiRequest<JobPosting>(`/job-postings/${id}`);
}

export function createJobPosting(input: CreateJobPostingInput): Promise<JobPosting> {
  return apiRequest<JobPosting>("/job-postings", { method: "POST", body: input });
}

export function updateJobPosting(id: string, input: UpdateJobPostingInput): Promise<JobPosting> {
  return apiRequest<JobPosting>(`/job-postings/${id}`, { method: "PATCH", body: input });
}

export function deleteJobPosting(id: string): Promise<void> {
  return apiRequest<void>(`/job-postings/${id}`, { method: "DELETE" });
}
