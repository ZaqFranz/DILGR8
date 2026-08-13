import { apiRequest } from "@/shared/api/apiClient";
import type { AuditLogEntry } from "../types";

export function listAuditLogs(filters?: { entityType?: string; search?: string }): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams();
  if (filters?.entityType) params.set("entityType", filters.entityType);
  if (filters?.search) params.set("search", filters.search);
  const query = params.toString();
  return apiRequest<AuditLogEntry[]>(`/audit-logs${query ? `?${query}` : ""}`);
}
