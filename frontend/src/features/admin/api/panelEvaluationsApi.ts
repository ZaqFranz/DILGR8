import { apiRequest } from "@/shared/api/apiClient";
import type { TabulationResult } from "../types";

export function getTabulation(jobPostingId: string): Promise<TabulationResult> {
  return apiRequest<TabulationResult>(`/panel-evaluations/tabulation/${jobPostingId}`);
}
