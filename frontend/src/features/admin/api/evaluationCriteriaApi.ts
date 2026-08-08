import { apiRequest } from "@/shared/api/apiClient";
import type { CreateEvaluationCriterionInput, EvaluationCriterion, UpdateEvaluationCriterionInput } from "../types";

export function listEvaluationCriteria(): Promise<EvaluationCriterion[]> {
  return apiRequest<EvaluationCriterion[]>("/evaluation-criteria");
}

export function createEvaluationCriterion(input: CreateEvaluationCriterionInput): Promise<EvaluationCriterion> {
  return apiRequest<EvaluationCriterion>("/evaluation-criteria", { method: "POST", body: input });
}

export function updateEvaluationCriterion(
  id: string,
  input: UpdateEvaluationCriterionInput,
): Promise<EvaluationCriterion> {
  return apiRequest<EvaluationCriterion>(`/evaluation-criteria/${id}`, { method: "PATCH", body: input });
}

export function deleteEvaluationCriterion(id: string): Promise<void> {
  return apiRequest<void>(`/evaluation-criteria/${id}`, { method: "DELETE" });
}
