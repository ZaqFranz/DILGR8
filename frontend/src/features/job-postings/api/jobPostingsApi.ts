import { apiRequest } from "@/shared/api/apiClient";
import type { CreateJobPostingInput, JobPosting, JobPostingStatus } from "../types";

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
