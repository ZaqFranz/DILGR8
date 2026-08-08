import { apiRequest } from "@/shared/api/apiClient";
import type { DashboardSummary } from "../types";

export function getDashboardSummary(): Promise<DashboardSummary> {
  return apiRequest<DashboardSummary>("/dashboard/summary");
}
