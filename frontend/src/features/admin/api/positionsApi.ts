import { apiRequest } from "@/shared/api/apiClient";
import type { CreatePositionInput, Position, UpdatePositionInput } from "../types";

export function listPositions(): Promise<Position[]> {
  return apiRequest<Position[]>("/positions");
}

export function createPosition(input: CreatePositionInput): Promise<Position> {
  return apiRequest<Position>("/positions", { method: "POST", body: input });
}

export function updatePosition(id: string, input: UpdatePositionInput): Promise<Position> {
  return apiRequest<Position>(`/positions/${id}`, { method: "PATCH", body: input });
}

export function deletePosition(id: string): Promise<void> {
  return apiRequest<void>(`/positions/${id}`, { method: "DELETE" });
}
