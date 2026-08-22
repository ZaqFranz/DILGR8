import { apiRequest } from "@/shared/api/apiClient";
import type {
  CreateHistoricalHiringRecordInput,
  HirePrediction,
  HistoricalHiringRecord,
  UpdateHistoricalHiringRecordInput,
} from "../types";

export function listHistoricalHiringRecords(): Promise<HistoricalHiringRecord[]> {
  return apiRequest<HistoricalHiringRecord[]>("/historical-hiring-records");
}

export function createHistoricalHiringRecord(
  input: CreateHistoricalHiringRecordInput,
): Promise<HistoricalHiringRecord> {
  return apiRequest<HistoricalHiringRecord>("/historical-hiring-records", { method: "POST", body: input });
}

export function updateHistoricalHiringRecord(
  id: string,
  input: UpdateHistoricalHiringRecordInput,
): Promise<HistoricalHiringRecord> {
  return apiRequest<HistoricalHiringRecord>(`/historical-hiring-records/${id}`, { method: "PATCH", body: input });
}

export function deleteHistoricalHiringRecord(id: string): Promise<void> {
  return apiRequest<void>(`/historical-hiring-records/${id}`, { method: "DELETE" });
}

export function predictHirePercentages(applicationIds: string[]): Promise<HirePrediction[]> {
  if (applicationIds.length === 0) return Promise.resolve([]);
  const query = encodeURIComponent(applicationIds.join(","));
  return apiRequest<HirePrediction[]>(`/historical-hiring-records/predict?applicationIds=${query}`);
}
