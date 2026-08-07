import { apiRequest } from "@/shared/api/apiClient";
import type { AuditLogEntry } from "../types";

export function listAuditLogs(entityType?: string): Promise<AuditLogEntry[]> {
  const query = entityType ? `?entityType=${encodeURIComponent(entityType)}` : "";
  return apiRequest<AuditLogEntry[]>(`/audit-logs${query}`);
}
