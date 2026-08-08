import { useEffect, useState, type SVGProps } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { formatAuditAction } from "@/shared/utils/formatAuditAction";
import { AdminShell } from "../components/AdminShell";
import { getDashboardSummary } from "../api/dashboardApi";
import type { ApplicationStatus, DashboardSummary } from "../types";

const APPLICATION_STATUS_META: Record<ApplicationStatus, { label: string; color: string }> = {
  SUBMITTED: { label: "Submitted", color: "var(--color-info)" },
  UNDER_SIFTING: { label: "Under Sifting", color: "var(--color-warning)" },
  QUALIFIED: { label: "Qualified", color: "var(--color-success)" },
  NOT_QUALIFIED: { label: "Not Qualified", color: "var(--color-danger)" },
  WITHDRAWN: { label: "Withdrawn", color: "var(--color-muted)" },
};
const APPLICATION_STATUS_ORDER: ApplicationStatus[] = [
  "SUBMITTED",
  "UNDER_SIFTING",
  "QUALIFIED",
  "NOT_QUALIFIED",
  "WITHDRAWN",
];

function iconProps(props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> {
  return { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", ...props };
}

function ApplicantsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  );
}

function JobPostingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </svg>
  );
}

function ApplicationsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h8" />
    </svg>
  );
}

function UsersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <circle cx="9" cy="8" r="3" />
      <path d="M2 20c0-3.5 3-5.5 7-5.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M14.3 20c.3-3 2.3-5 6-5" />
    </svg>
  );
}

interface BarRow {
  key: string;
  label: string;
  value: number;
  color: string;
}

function BarChart({ rows, emptyLabel }: { rows: BarRow[]; emptyLabel: string }) {
  if (rows.every((row) => row.value === 0)) {
    return <p className="chart-empty">{emptyLabel}</p>;
  }
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className="bar-chart">
      {rows.map((row) => (
        <div className="bar-row" key={row.key}>
          <span className="bar-row-label" title={row.label}>
            {row.label}
          </span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${(row.value / max) * 100}%`, background: row.color }}
            />
          </div>
          <span className="bar-value">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboardSummary()
      .then(setSummary)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminShell>
      <div className="dashboard-hero">
        <div>
          <h1>Dashboard</h1>
          <p>Overview of applicants, job postings, and applications across the RSP pipeline.</p>
        </div>
      </div>
      <ErrorBanner message={error} />

      {loading && <LoadingBlock />}

      {!loading && summary && (
        <>
          <div className="stat-tile-row">
            <div className="stat-tile">
              <span className="stat-tile-icon">
                <ApplicantsIcon />
              </span>
              <div className="stat-tile-body">
                <span className="stat-tile-label">Applicants</span>
                <span className="stat-tile-value">{summary.applicants.total}</span>
                <span className="stat-tile-sub">{summary.applicants.registrationComplete} completed registration</span>
              </div>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-icon">
                <JobPostingsIcon />
              </span>
              <div className="stat-tile-body">
                <span className="stat-tile-label">Job Postings</span>
                <span className="stat-tile-value">{summary.jobPostings.total}</span>
                <span className="stat-tile-sub">
                  {summary.jobPostings.byStatus.OPEN} open &middot; {summary.jobPostings.byStatus.CLOSED} closed
                </span>
              </div>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-icon">
                <ApplicationsIcon />
              </span>
              <div className="stat-tile-body">
                <span className="stat-tile-label">Applications</span>
                <span className="stat-tile-value">{summary.applications.total}</span>
                <span className="stat-tile-sub">
                  {summary.applications.byStatus.SUBMITTED + summary.applications.byStatus.UNDER_SIFTING} awaiting evaluation
                </span>
              </div>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-icon">
                <UsersIcon />
              </span>
              <div className="stat-tile-body">
                <span className="stat-tile-label">Users</span>
                <span className="stat-tile-value">{summary.users.total}</span>
                <span className="stat-tile-sub">
                  {summary.users.byRole.ADMIN} admin &middot; {summary.users.byRole.APPLICANT} applicant
                </span>
              </div>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="card">
              <h2>Applications by status</h2>
              <BarChart
                emptyLabel="No applications submitted yet."
                rows={APPLICATION_STATUS_ORDER.map((status) => ({
                  key: status,
                  label: APPLICATION_STATUS_META[status].label,
                  value: summary.applications.byStatus[status],
                  color: APPLICATION_STATUS_META[status].color,
                }))}
              />
            </div>

            <div className="card">
              <h2>Top job postings by applications</h2>
              <BarChart
                emptyLabel="No applications submitted yet."
                rows={summary.topJobPostings.map((posting) => ({
                  key: posting.jobPostingId,
                  label: posting.title,
                  value: posting.applicationCount,
                  color: "var(--color-accent-hover)",
                }))}
              />
            </div>
          </div>

          <h2>Recent activity</h2>
          {summary.recentActivity.length === 0 && <p>No activity recorded yet.</p>}
          {summary.recentActivity.length > 0 && (
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
                  {summary.recentActivity.map((entry) => (
                    <tr key={entry.id}>
                      <td>{new Date(entry.createdAt).toLocaleString()}</td>
                      <td>{entry.actor?.email ?? "(deleted user)"}</td>
                      <td>{formatAuditAction(entry.action)}</td>
                      <td>{entry.details ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AdminShell>
  );
}
