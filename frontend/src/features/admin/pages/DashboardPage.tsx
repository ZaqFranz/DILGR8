import { useCallback, useEffect, useState, type SVGProps } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { APPLICATION_STATUS_LABELS } from "@/shared/constants/applicationStatus";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { Spinner } from "@/shared/components/Spinner";
import { formatAuditAction } from "@/shared/utils/formatAuditAction";
import { AdminShell } from "../components/AdminShell";
import { getDashboardSummary } from "../api/dashboardApi";
import type { ApplicationStatus, DashboardSummary } from "../types";

const USER_MANUAL_URL = "/DILGR8RSP-User-Manual.docx";

// Label text is the single shared APPLICATION_STATUS_LABELS source (kept in
// sync with the admin Evaluate Applicants table and the applicant-facing My
// Applications page) - only the per-status bar color is specific to this chart.
const APPLICATION_STATUS_META: Record<ApplicationStatus, { label: string; color: string }> = {
  SUBMITTED: { label: APPLICATION_STATUS_LABELS.SUBMITTED, color: "var(--color-info)" },
  UNDER_SIFTING: { label: APPLICATION_STATUS_LABELS.UNDER_SIFTING, color: "var(--color-warning)" },
  FOR_INTERVIEW: { label: APPLICATION_STATUS_LABELS.FOR_INTERVIEW, color: "var(--color-accent-hover)" },
  QUALIFIED: { label: APPLICATION_STATUS_LABELS.QUALIFIED, color: "var(--color-success)" },
  NOT_QUALIFIED: { label: APPLICATION_STATUS_LABELS.NOT_QUALIFIED, color: "var(--color-danger)" },
  FOR_COMPLIANCE: { label: APPLICATION_STATUS_LABELS.FOR_COMPLIANCE, color: "var(--color-info)" },
  NOT_SELECTED: { label: APPLICATION_STATUS_LABELS.NOT_SELECTED, color: "var(--color-danger)" },
  DISQUALIFIED: { label: APPLICATION_STATUS_LABELS.DISQUALIFIED, color: "var(--color-danger)" },
  FOR_OATH_TAKING: { label: APPLICATION_STATUS_LABELS.FOR_OATH_TAKING, color: "var(--color-accent-hover)" },
  HIRED: { label: APPLICATION_STATUS_LABELS.HIRED, color: "var(--color-success)" },
  WITHDRAWN: { label: APPLICATION_STATUS_LABELS.WITHDRAWN, color: "var(--color-muted)" },
};
const APPLICATION_STATUS_ORDER: ApplicationStatus[] = [
  "SUBMITTED",
  "UNDER_SIFTING",
  "FOR_INTERVIEW",
  "QUALIFIED",
  "NOT_QUALIFIED",
  "FOR_COMPLIANCE",
  "NOT_SELECTED",
  "DISQUALIFIED",
  "FOR_OATH_TAKING",
  "HIRED",
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback((options?: { silent?: boolean }) => {
    if (options?.silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    return getDashboardSummary()
      .then(setSummary)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load dashboard"))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // The counts here (e.g. after deleting a user in Users Management) can go
  // stale if this page was left open the whole time - normal SPA navigation
  // away and back already remounts and refetches, but a still-mounted tab
  // regaining focus/visibility, or a browser back/forward-cache restore,
  // wouldn't otherwise trigger a refetch on its own.
  useEffect(() => {
    function handleFocusOrVisible() {
      if (document.visibilityState === "hidden") return;
      loadSummary({ silent: true });
    }
    window.addEventListener("focus", handleFocusOrVisible);
    document.addEventListener("visibilitychange", handleFocusOrVisible);
    return () => {
      window.removeEventListener("focus", handleFocusOrVisible);
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
    };
  }, [loadSummary]);

  return (
    <AdminShell>
      <div className="dashboard-hero">
        <div>
          <h1>Dashboard</h1>
          <p>Overview of applicants, job postings, and applications across the RSP pipeline.</p>
        </div>
        <div className="dashboard-hero-actions">
          <a
            className="button secondary"
            href={USER_MANUAL_URL}
            download="DILGR8RSP User Manual.docx"
          >
            User Manual
          </a>
          <button
            type="button"
            className="secondary"
            disabled={loading || refreshing}
            onClick={() => loadSummary({ silent: true })}
          >
            {refreshing && <Spinner size="sm" />}
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
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
                  {summary.applications.byStatus.SUBMITTED +
                    summary.applications.byStatus.UNDER_SIFTING +
                    summary.applications.byStatus.FOR_INTERVIEW}{" "}
                  awaiting a decision
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
                  {summary.users.byRole.ADMIN} admin &middot; {summary.users.byRole.PANEL} panel &middot;{" "}
                  {summary.users.byRole.APPLICANT} applicant
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
