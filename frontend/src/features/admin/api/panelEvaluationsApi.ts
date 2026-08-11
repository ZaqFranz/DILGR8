import { apiRequest } from "@/shared/api/apiClient";
import type { ApplicantScoresOverview, TabulationResult } from "../types";

export function getTabulation(jobPostingId: string): Promise<TabulationResult> {
  return apiRequest<TabulationResult>(`/panel-evaluations/tabulation/${jobPostingId}`);
}

export function getApplicantScoresOverview(): Promise<ApplicantScoresOverview> {
  return apiRequest<ApplicantScoresOverview>("/panel-evaluations/applicant-scores");
}
