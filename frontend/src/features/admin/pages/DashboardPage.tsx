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

// Job postings are arbitrary identities (unlike application status, which
// reuses the app's existing semantic badge colors) - this is the dataviz
// skill's validated 8-hue categorical theme, first 5 slots (matches
// TOP_JOB_POSTINGS_LIMIT on the backend). Past 3 slots the theme's own
// adjacent-pair CVD guarantee needs the "relief rule" mitigation - satisfied
// here since PieChart always renders a text legend alongside the chart, so
// no posting is ever identified by color alone.
const CATEGORICAL_CHART_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];

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

interface ChartRow {
  key: string;
  label: string;
  value: number;
  color: string;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const angleRad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

const PIE_SIZE = 160;
const PIE_RADIUS = PIE_SIZE / 2;
// Below this share, a slice gets a legend entry but no in-chart percentage
// label - direct-labeling every one of up to 11 statuses would collide and
// clutter a slice this small; the legend (always shown alongside, itself
// the exact-numbers table view) is the source of truth for it.
const PIE_DIRECT_LABEL_MIN_SHARE = 0.08;

/**
 * Only statuses with at least one application become a slice - most of the
 * 11 possible statuses are empty at any given time, and rendering those as
 * zero-width slices would add nothing but legend/label clutter (see
 * dataviz skill's "more than ~7 classes -> table, not more colors": this
 * keeps the chart at whatever the data actually spans, which is usually
 * well under that).
 */
function PieChart({ rows, emptyLabel, ariaLabel }: { rows: ChartRow[]; emptyLabel: string; ariaLabel: string }) {
  const nonZero = rows.filter((row) => row.value > 0);
  const total = nonZero.reduce((sum, row) => sum + row.value, 0);
  if (total === 0) {
    return <p className="chart-empty">{emptyLabel}</p>;
  }

  let cumulativeAngle = -90; // 12 o'clock start, clockwise
  const slices = nonZero.map((row) => {
    const share = row.value / total;
    // Capped just under a full turn so a single 100% slice still traces a
    // valid arc (identical start/end points make the arc command degenerate).
    const sweep = Math.min(share * 360, 359.999);
    const startAngle = cumulativeAngle;
    const endAngle = startAngle + sweep;
    cumulativeAngle = endAngle;
    const start = polarToCartesian(PIE_RADIUS, PIE_RADIUS, PIE_RADIUS, startAngle);
    const end = polarToCartesian(PIE_RADIUS, PIE_RADIUS, PIE_RADIUS, endAngle);
    const largeArcFlag = sweep > 180 ? 1 : 0;
    const path = `M ${PIE_RADIUS} ${PIE_RADIUS} L ${start.x} ${start.y} A ${PIE_RADIUS} ${PIE_RADIUS} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
    const midAngle = startAngle + sweep / 2;
    const labelPos = polarToCartesian(PIE_RADIUS, PIE_RADIUS, PIE_RADIUS * 0.66, midAngle);
    return { ...row, path, share, labelPos };
  });

  return (
    <div className="pie-chart">
      <svg viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`} className="pie-chart-svg" role="img" aria-label={ariaLabel}>
        {slices.map((slice) => (
          <path key={slice.key} d={slice.path} fill={slice.color} stroke="var(--color-surface)" strokeWidth={2}>
            <title>
              {slice.label}: {slice.value} ({(slice.share * 100).toFixed(1)}%)
            </title>
          </path>
        ))}
        {slices
          .filter((slice) => slice.share >= PIE_DIRECT_LABEL_MIN_SHARE)
          .map((slice) => (
            <text
              key={`${slice.key}-label`}
              x={slice.labelPos.x}
              y={slice.labelPos.y}
              className="pie-chart-slice-label"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {Math.round(slice.share * 100)}%
            </text>
          ))}
      </svg>
      <ul className="pie-chart-legend">
        {nonZero.map((row) => (
          <li key={row.key}>
            <span className="pie-chart-swatch" style={{ background: row.color }} />
            <span className="pie-chart-legend-label" title={row.label}>
              {row.label}
            </span>
            <span className="pie-chart-legend-value">{row.value}</span>
          </li>
        ))}
      </ul>
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
              <PieChart
                ariaLabel="Applications by status"
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
              <PieChart
                ariaLabel="Top job postings by applications"
                emptyLabel="No applications submitted yet."
                rows={summary.topJobPostings.map((posting, index) => ({
                  key: posting.jobPostingId,
                  label: posting.title,
                  value: posting.applicationCount,
                  color: CATEGORICAL_CHART_COLORS[index % CATEGORICAL_CHART_COLORS.length]!,
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
