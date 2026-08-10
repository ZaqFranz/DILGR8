import { useEffect, useState } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { Pagination } from "@/shared/components/Pagination";
import { formatAuditAction } from "@/shared/utils/formatAuditAction";
import { usePagination } from "@/shared/utils/usePagination";
import { AdminShell } from "../components/AdminShell";
import { listAuditLogs } from "../api/auditLogsApi";
import type { AuditLogEntry } from "../types";

const ENTITY_TYPE_OPTIONS = [
  { value: "", label: "All" },
  { value: "User", label: "Users" },
  { value: "JobPosting", label: "Job Postings" },
  { value: "Application", label: "Applications" },
];

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [entityType, setEntityType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pagination = usePagination(logs, 10);

  useEffect(() => {
    setLoading(true);
    listAuditLogs(entityType || undefined)
      .then(setLogs)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load logs"))
      .finally(() => setLoading(false));
  }, [entityType]);

  return (
    <AdminShell>
      <h1>History of Logs</h1>
      <p>Read-only record of admin actions - user, job posting, and evaluation changes. Entries cannot be edited or deleted.</p>
      <ErrorBanner message={error} />

      <div className="field" style={{ maxWidth: 260 }}>
        <label htmlFor="entity-type">Filter by type</label>
        <select
          id="entity-type"
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            pagination.setPage(1);
          }}
        >
          {ENTITY_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {loading && <LoadingBlock />}
      {!loading && logs.length === 0 && <p>No log entries yet.</p>}
      {!loading && logs.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {pagination.pageItems.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.createdAt).toLocaleString()}</td>
                  <td>{log.actor?.email ?? "(deleted user)"}</td>
                  <td>{formatAuditAction(log.action)}</td>
                  <td>{log.details ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            pageSize={10}
            onPageChange={pagination.setPage}
          />
        </div>
      )}
    </AdminShell>
  );
}
