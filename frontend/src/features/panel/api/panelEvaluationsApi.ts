import { apiRequest } from "@/shared/api/apiClient";
import type { InterviewQueueApplication, PanelEvaluation, SubmitPanelEvaluationInput } from "@/features/admin/types";

export function getMyQueue(): Promise<InterviewQueueApplication[]> {
  return apiRequest<InterviewQueueApplication[]>("/panel-evaluations/my-queue");
}

export function submitEvaluation(applicationId: string, input: SubmitPanelEvaluationInput): Promise<PanelEvaluation> {
  return apiRequest<PanelEvaluation>(`/panel-evaluations/${applicationId}`, { method: "PATCH", body: input });
}
